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
        selectedCountElement.textContent = selectedImages.size;
        downloadBtn.disabled = selectedImages.size === 0;
    }

    function renderImages(images) {
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
        imageCountElement.textContent = images.length;
        updateSelectedCount();
    }

    function showError(message) {
        statusElement.classList.add('hidden');
        loadingElement.classList.add('hidden');
        mainContentElement.classList.add('hidden');
        errorElement.classList.remove('hidden');
        errorMessageElement.textContent = message;
    }

    function showLoading() {
        statusElement.classList.add('hidden');
        errorElement.classList.add('hidden');
        mainContentElement.classList.add('hidden');
        loadingElement.classList.remove('hidden');
    }

    function showMainContent() {
        statusElement.classList.add('hidden');
        errorElement.classList.add('hidden');
        loadingElement.classList.add('hidden');
        successElement.classList.add('hidden');
        mainContentElement.classList.remove('hidden');
    }

    function showSuccess(successCount) {
        mainContentElement.classList.add('hidden');
        successElement.classList.remove('hidden');
        successSummary.innerHTML = `Successfully downloaded ${successCount} images and metadata.`;
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

    retryBtn.addEventListener('click', function() {
        loadPageData();
    });

    selectAllBtn.addEventListener('click', function() {
        images.forEach((imageData, index) => {
            selectedImages.add(index);
            const checkbox = imagesGrid.querySelectorAll('.image-checkbox')[index];
            if (checkbox) checkbox.checked = true;
        });
        updateSelectedCount();
    });

    deselectAllBtn.addEventListener('click', function() {
        selectedImages.clear();
        imagesGrid.querySelectorAll('.image-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        updateSelectedCount();
    });

    downloadBtn.addEventListener('click', async function() {
        const selectedImageList = images.filter((_, index) => selectedImages.has(index));

        downloadBtn.querySelector('.btn-text').textContent = 'Saving...';
        downloadBtn.querySelector('.btn-spinner').classList.remove('hidden');
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
            downloadBtn.querySelector('.btn-text').textContent = 'Save Selected Images';
            downloadBtn.querySelector('.btn-spinner').classList.add('hidden');
        }
    });

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
            productNameElement.textContent = metadata.productName || 'N/A';
            vendorNameElement.textContent = metadata.vendorName || 'N/A';
            priceElement.textContent = metadata.price || 'N/A';
            productIdElement.textContent = metadata.productId || 'N/A';
            
            // Show/hide optional metadata fields
            if (metadata.storeStatus) {
                storeStatusElement.textContent = metadata.storeStatus;
                storeStatusContainer.style.display = 'block';
            } else {
                storeStatusContainer.style.display = 'none';
            }
            
            if (metadata.marketplaceInfo) {
                marketplaceInfoElement.textContent = metadata.marketplaceInfo;
                marketplaceContainer.style.display = 'block';
            } else {
                marketplaceContainer.style.display = 'none';
            }

            // Render images
            renderImages(images);
            showMainContent();
        } catch (error) {
            showError('Failed to load images and metadata: ' + error.message);
        }
    }

    // Event Listeners for AI Analysis
    apiKeyBtn.addEventListener('click', () => {
        console.log('Opening API key modal');
        apiKeyModal.classList.remove('hidden');
    });

    modalClose.addEventListener('click', (e) => {
        console.log('Modal close button clicked');
        e.preventDefault();
        e.stopPropagation();
        apiKeyModal.classList.add('hidden');
    });

    cancelBtn.addEventListener('click', (e) => {
        console.log('Cancel button clicked');
        e.preventDefault();
        e.stopPropagation();
        apiKeyModal.classList.add('hidden');
    });

    // Close modal when clicking outside of it
    apiKeyModal.addEventListener('click', (e) => {
        console.log('Modal background clicked');
        if (e.target === apiKeyModal) {
            apiKeyModal.classList.add('hidden');
        }
    });

    saveKeyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            try {
                // Set API Key in chrome storage
                await chrome.storage.local.set({ apiKey });
                apiKeyModal.classList.add('hidden');
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

    aiAnalyzeBtn.addEventListener('click', async () => {
        aiAnalyzeBtn.querySelector('.btn-text').textContent = 'Analyzing...';
        aiAnalyzeBtn.querySelector('.btn-spinner').classList.remove('hidden');
        aiAnalyzeBtn.disabled = true;
        chrome.runtime.sendMessage({ action: 'analyzeScreenshot' }, (response) => {
            aiAnalyzeBtn.querySelector('.btn-text').textContent = 'Analyze Product';
            aiAnalyzeBtn.querySelector('.btn-spinner').classList.add('hidden');
            aiAnalyzeBtn.disabled = false;

            if (response.success) {
                aiDescription.textContent = response.result.description;
                aiResults.classList.remove('hidden');
                aiError.classList.add('hidden');
            } else {
                aiErrorMessage.textContent = response.error || 'Failed to analyze product';
                aiError.classList.remove('hidden');
                aiResults.classList.add('hidden');
            }
        });
    });

    loadPageData();
});

