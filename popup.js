document.addEventListener('DOMContentLoaded', function() {
    const statusElement = document.getElementById('status');
    const contentElement = document.getElementById('content');
    const loadingElement = document.getElementById('loading');
    const errorElement = document.getElementById('error');
    const errorMessageElement = document.getElementById('errorMessage');
    const retryBtn = document.getElementById('retryBtn');
    const mainContentElement = document.getElementById('mainContent');
    const successElement = document.getElementById('success');
    const successSummary = document.getElementById('successSummary');

    const imagesGrid = document.getElementById('imagesGrid');
    const imageCountElement = document.getElementById('imageCount');
    const productNameElement = document.getElementById('productName');
    const vendorNameElement = document.getElementById('vendorName');
    const priceElement = document.getElementById('price');
    const productIdElement = document.getElementById('productId');
    const storeStatusElement = document.getElementById('storeStatus');
    const storeStatusContainer = document.getElementById('storeStatusContainer');
    const marketplaceInfoElement = document.getElementById('marketplaceInfo');
    const marketplaceContainer = document.getElementById('marketplaceContainer');
    const selectedCountElement = document.getElementById('selectedCount');
    const downloadBtn = document.getElementById('downloadBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    const forceRetryBtn = document.getElementById('forceRetryBtn');
    
    // AI Analysis elements
    const aiAnalyzeBtn = document.getElementById('aiAnalyzeBtn');
    const apiKeyBtn = document.getElementById('apiKeyBtn');
    const aiResults = document.getElementById('aiResults');
    const aiDescription = document.getElementById('aiDescription');
    const aiError = document.getElementById('aiError');
    const aiErrorMessage = document.getElementById('aiErrorMessage');
    
    // Modal elements
    const apiKeyModal = document.getElementById('apiKeyModal');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveKeyBtn = document.getElementById('saveKeyBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const modalClose = document.getElementById('modalClose');
    
    // Debug: Check if elements exist
    console.log('Modal elements found:', {
        apiKeyModal: !!apiKeyModal,
        apiKeyInput: !!apiKeyInput,
        saveKeyBtn: !!saveKeyBtn,
        cancelBtn: !!cancelBtn,
        modalClose: !!modalClose
    });

    let images = [];
    let metadata = {};
    let selectedImages = new Set();

    async function sendMessageToContentScript(message) {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, message, function(response) {
                    if (chrome.runtime.lastError) {
                        reject(new Error('Failed to communicate with content script'));
                    } else {
                        resolve(response);
                    }
                });
            });
        });
    }

    function updateSelectedCount() {
        if (selectedCountElement) selectedCountElement.textContent = selectedImages.size;
        if (downloadBtn) downloadBtn.disabled = selectedImages.size === 0;
    }

    function renderImages(images) {
        if (!imagesGrid) return;
        
        imagesGrid.innerHTML = '';
        images.forEach((imageData, index) => {
            const imageItem = document.createElement('div');
            imageItem.className = 'image-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'image-checkbox';
            checkbox.checked = selectedImages.has(index);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    selectedImages.add(index);
                } else {
                    selectedImages.delete(index);
                }
                updateSelectedCount();
            });

            const img = document.createElement('img');
            img.src = imageData.url;
            img.alt = imageData.alt;
            img.title = imageData.filename;
            img.className = 'image-thumbnail';

            imageItem.appendChild(checkbox);
            imageItem.appendChild(img);
            imagesGrid.appendChild(imageItem);
        });
        if (imageCountElement) imageCountElement.textContent = images.length;
        updateSelectedCount();
    }

    function showError(message) {
        if (statusElement) statusElement.classList.add('hidden');
        if (loadingElement) loadingElement.classList.add('hidden');
        if (mainContentElement) mainContentElement.classList.add('hidden');
        if (errorElement) errorElement.classList.remove('hidden');
        if (errorMessageElement) errorMessageElement.textContent = message;
    }

    function showLoading() {
        if (statusElement) statusElement.classList.add('hidden');
        if (errorElement) errorElement.classList.add('hidden');
        if (mainContentElement) mainContentElement.classList.add('hidden');
        if (loadingElement) loadingElement.classList.remove('hidden');
    }

    function showMainContent() {
        if (statusElement) statusElement.classList.add('hidden');
        if (errorElement) errorElement.classList.add('hidden');
        if (loadingElement) loadingElement.classList.add('hidden');
        if (successElement) successElement.classList.add('hidden');
        if (mainContentElement) mainContentElement.classList.remove('hidden');
    }

    function showSuccess(successCount) {
        if (mainContentElement) mainContentElement.classList.add('hidden');
        if (successElement) successElement.classList.remove('hidden');
        if (successSummary) successSummary.innerHTML = `Successfully downloaded ${successCount} images and metadata.`;
    }

    function showNotification(message, type = 'success') {
        // Create a temporary notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 10px 15px;
            border-radius: 4px;
            color: white;
            font-size: 13px;
            z-index: 10000;
            max-width: 250px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            background-color: ${type === 'error' ? '#dc3545' : '#28a745'};
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 3000);
    }

    if (retryBtn) {
        retryBtn.addEventListener('click', function() {
            loadPageData();
        });
    }

    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', function() {
            images.forEach((imageData, index) => {
                selectedImages.add(index);
                if (imagesGrid) {
                    const checkbox = imagesGrid.querySelectorAll('.image-checkbox')[index];
                    if (checkbox) checkbox.checked = true;
                }
            });
            updateSelectedCount();
        });
    }

    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', function() {
            selectedImages.clear();
            if (imagesGrid) {
                imagesGrid.querySelectorAll('.image-checkbox').forEach(checkbox => {
                    checkbox.checked = false;
                });
            }
            updateSelectedCount();
        });
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', async function() {
            const selectedImageList = images.filter((_, index) => selectedImages.has(index));

            const btnText = downloadBtn.querySelector('.btn-text');
            const btnSpinner = downloadBtn.querySelector('.btn-spinner');
            
            if (btnText) btnText.textContent = 'Saving...';
            if (btnSpinner) btnSpinner.classList.remove('hidden');
            downloadBtn.disabled = true;

            const data = { selectedImages: selectedImageList, metadata };
            try {
                const response = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({ action: 'downloadImages', data }, result => {
                        if (chrome.runtime.lastError) {
                            return reject(new Error(chrome.runtime.lastError));
                        }
                        resolve(result);
                    });
                });

                if (response && response.success) {
                    showSuccess(response.result.summary.successful);
                } else {
                    showError(response.error || 'Failed to download images');
                }
            } catch (error) {
                showError(error.message);
            } finally {
                if (btnText) btnText.textContent = 'Save Selected Images';
                if (btnSpinner) btnSpinner.classList.add('hidden');
            }
        });
    }

    async function loadPageData() {
        showLoading();
        try {
            const data = await sendMessageToContentScript({ action: 'extractData' });
            if (data.error) {
                showError(data.error);
                return;
            }
            images = data.images || [];
            metadata = data.metadata || {};

            // Update metadata display
            if (productNameElement) productNameElement.textContent = metadata.productName || 'N/A';
            if (vendorNameElement) vendorNameElement.textContent = metadata.vendorName || 'N/A';
            if (priceElement) priceElement.textContent = metadata.price || 'N/A';
            if (productIdElement) productIdElement.textContent = metadata.productId || 'N/A';
            
            // Show/hide optional metadata fields
            if (metadata.storeStatus) {
                if (storeStatusElement) storeStatusElement.textContent = metadata.storeStatus;
                if (storeStatusContainer) storeStatusContainer.style.display = 'block';
            } else {
                if (storeStatusContainer) storeStatusContainer.style.display = 'none';
            }
            
            if (metadata.marketplaceInfo) {
                if (marketplaceInfoElement) marketplaceInfoElement.textContent = metadata.marketplaceInfo;
                if (marketplaceContainer) marketplaceContainer.style.display = 'block';
            } else {
                if (marketplaceContainer) marketplaceContainer.style.display = 'none';
            }

            // Render images
            renderImages(images);
            showMainContent();
        } catch (error) {
            showError('Failed to load images and metadata: ' + error.message);
        }
    }

    // Event Listeners for AI Analysis
    if (apiKeyBtn && apiKeyModal) {
        apiKeyBtn.addEventListener('click', () => {
            console.log('Opening API key modal');
            apiKeyModal.style.display = 'flex';
        });
    }

    if (modalClose && apiKeyModal) {
        modalClose.addEventListener('click', (e) => {
            console.log('Modal close button clicked');
            e.preventDefault();
            e.stopPropagation();
            apiKeyModal.style.display = 'none';
        });
    }

    if (cancelBtn && apiKeyModal) {
        cancelBtn.addEventListener('click', (e) => {
            console.log('Cancel button clicked');
            e.preventDefault();
            e.stopPropagation();
            apiKeyModal.style.display = 'none';
        });
    }

    // Close modal when clicking outside of it
    if (apiKeyModal) {
        apiKeyModal.addEventListener('click', (e) => {
            console.log('Modal background clicked');
            if (e.target === apiKeyModal) {
                apiKeyModal.style.display = 'none';
            }
        });
    }

    if (saveKeyBtn && apiKeyInput && apiKeyModal) {
        saveKeyBtn.addEventListener('click', async (e) => {
            console.log('Save button clicked');
            e.preventDefault();
            e.stopPropagation();
            const apiKey = apiKeyInput.value.trim();
            if (apiKey) {
                try {
                    // Set API Key in chrome storage
                    await chrome.storage.local.set({ apiKey });
                    apiKeyModal.style.display = 'none';
                    apiKeyInput.value = '';
                    console.log('API Key saved successfully');
                    // Use a more subtle notification instead of alert
                    showNotification('API Key saved successfully!');
                } catch (error) {
                    console.error('Failed to save API key:', error);
                    showNotification('Failed to save API Key', 'error');
                }
            } else {
                showNotification('Please enter a valid API Key', 'error');
            }
        });
    }

    if (aiAnalyzeBtn) {
        aiAnalyzeBtn.addEventListener('click', async () => {
            const btnText = aiAnalyzeBtn.querySelector('.btn-text');
            const btnSpinner = aiAnalyzeBtn.querySelector('.btn-spinner');
            
            if (btnText) btnText.textContent = 'Analyzing...';
            if (btnSpinner) btnSpinner.classList.remove('hidden');
            aiAnalyzeBtn.disabled = true;
            
            chrome.runtime.sendMessage({ action: 'analyzeScreenshot' }, (response) => {
                if (btnText) btnText.textContent = 'Analyze Product';
                if (btnSpinner) btnSpinner.classList.add('hidden');
                aiAnalyzeBtn.disabled = false;

                if (response && response.success) {
                    if (aiDescription) aiDescription.textContent = response.result.description;
                    if (aiResults) aiResults.classList.remove('hidden');
                    if (aiError) aiError.classList.add('hidden');
                } else {
                    if (aiErrorMessage) aiErrorMessage.textContent = response?.error || 'Failed to analyze product';
                    if (aiError) aiError.classList.remove('hidden');
                    if (aiResults) aiResults.classList.add('hidden');
                }
            });
        });
    }
    
    if (forceRetryBtn) {
        forceRetryBtn.addEventListener('click', async function() {
            const btnText = forceRetryBtn.querySelector('.btn-text');
            const btnSpinner = forceRetryBtn.querySelector('.btn-spinner');
            
            if (btnText) btnText.textContent = '🔄 Retrying...';
            if (btnSpinner) btnSpinner.classList.remove('hidden');
            forceRetryBtn.disabled = true;

            try {
                const data = await sendMessageToContentScript({ action: 'forceRetry' });
                if (data.error) {
                    showError(`Force retry failed: ${data.error}`);
                    return;
                }
                
                images = data.images || [];
                metadata = data.metadata || {};
                
                // Clear current selections
                selectedImages.clear();
                
                // Update metadata display
                if (productNameElement) productNameElement.textContent = metadata.productName || 'N/A';
                if (vendorNameElement) vendorNameElement.textContent = metadata.vendorName || 'N/A';
                if (priceElement) priceElement.textContent = metadata.price || 'N/A';
                if (productIdElement) productIdElement.textContent = metadata.productId || 'N/A';
                
                // Show/hide optional metadata fields
                if (metadata.storeStatus) {
                    if (storeStatusElement) storeStatusElement.textContent = metadata.storeStatus;
                    if (storeStatusContainer) storeStatusContainer.style.display = 'block';
                } else {
                    if (storeStatusContainer) storeStatusContainer.style.display = 'none';
                }
                
                if (metadata.marketplaceInfo) {
                    if (marketplaceInfoElement) marketplaceInfoElement.textContent = metadata.marketplaceInfo;
                    if (marketplaceContainer) marketplaceContainer.style.display = 'block';
                } else {
                    if (marketplaceContainer) marketplaceContainer.style.display = 'none';
                }

                // Render updated images
                renderImages(images);
                showMainContent();
                
                showNotification(`Force retry completed! Found ${images.length} images.`);
                
            } catch (error) {
                showError('Force retry failed: ' + error.message);
            } finally {
                if (btnText) btnText.textContent = '🔄 Force Retry';
                if (btnSpinner) btnSpinner.classList.add('hidden');
                forceRetryBtn.disabled = false;
            }
        });
    }

    loadPageData();
});

