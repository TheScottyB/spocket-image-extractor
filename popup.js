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

    loadPageData();
});

