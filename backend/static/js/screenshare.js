/**
 * Screenshare module - Live capture with persistent stream and 2-second intervals
 * Maintains stream while toggle is ON, captures every 2 seconds, shows live preview
 */
const ScreenShare = {
    stream: null,
    currentScreenshot: null,
    captureInterval: null,
    isActive: false,
    previewContainer: null,
    previewImage: null,
    
    /**
     * Start persistent stream with window selection prompt
     * Called immediately when toggle is turned ON
     */
    async startStream() {
        try {
            console.log('Starting screenshare stream...');
            
            // Request screen selection from user
            this.stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: 'screen' },
                audio: false
            });
            
            // Get preview elements
            this.previewContainer = UI.elements.screensharePreviewContainer;
            this.previewImage = UI.elements.screensharePreviewImage;
            
            // Show preview container
            if (this.previewContainer) {
                this.previewContainer.style.display = 'flex';
            }
            
            // Show loading state immediately
            if (this.previewImage) {
                this.previewImage.src = 'data:image/svg+xml;base64,' + btoa(`
                    <svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
                        <rect width="100%" height="100%" fill="#f3f4f6"/>
                        <text x="50%" y="50%" text-anchor="middle" fill="#6b7280">Loading...</text>
                    </svg>
                `);
            }
            
            // Set up stream ended handler (auto-cleanup if user closes window)
            this.stream.getTracks().forEach(track => {
                track.addEventListener('ended', () => {
                    console.log('Screen share track ended - auto cleanup');
                    this.handleStreamEnded();
                });
            });
            
            // Capture first screenshot immediately
            await this.captureFrame();
            
            // Start 2-second interval captures
            this.captureInterval = setInterval(() => {
                this.captureFrame().catch(error => {
                    console.warn('Interval capture failed:', error);
                    // Don't cleanup on single failure, wait for next interval
                });
            }, 2000);
            
            this.isActive = true;
            console.log('Screenshare stream started successfully');
            
        } catch (error) {
            console.warn('Failed to start screenshare:', error);
            this.cleanup();
            // Turn off toggle since stream failed
            if (Tools.screenshareEnabled) {
                Tools.toggleScreenshare();
            }
        }
    },
    
    /**
     * Stop persistent stream and cleanup all references
     * Called when toggle is turned OFF
     */
    stopStream() {
        console.log('Stopping screenshare stream...');
        this.cleanup();
    },
    
    /**
     * Capture frame from existing stream and update preview
     * Overwrites previous screenshot to prevent memory accumulation
     */
    async captureFrame() {
        if (!this.stream || !this.isActive) return;
        
        try {
            // Clear previous screenshot data
            if (this.currentScreenshot) {
                this.currentScreenshot = null;
            }
            
            // Capture new frame
            this.currentScreenshot = await this.streamToBase64();
            
            // Update live preview
            this.updatePreview();
            
        } catch (error) {
            console.warn('Frame capture failed:', error);
            throw error; // Re-throw for interval handler
        }
    },
    
    /**
     * Update live preview image with latest screenshot
     */
    updatePreview() {
        if (this.previewImage && this.currentScreenshot) {
            // Clear previous image source
            this.previewImage.src = '';
            // Set new image
            this.previewImage.src = this.currentScreenshot;
        }
    },
    
    /**
     * Get current screenshot for message sending
     * Returns latest captured screenshot without additional capture
     */
    getCurrentScreenshot() {
        return this.currentScreenshot;
    },
    
    /**
     * Convert stream to base64 JPEG with temporary video element
     * More efficient since stream already exists
     */
    async streamToBase64() {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const video = document.createElement('video');
            
            video.srcObject = this.stream;
            video.play();
            
            const cleanup = () => {
                video.srcObject = null;
                video.remove();
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                canvas.remove();
            };
            
            video.addEventListener('loadedmetadata', () => {
                try {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0);
                    
                    // Get base64 JPEG at 80% quality
                    const base64 = canvas.toDataURL('image/jpeg', 0.8);
                    
                    cleanup();
                    resolve(base64);
                } catch (error) {
                    cleanup();
                    reject(error);
                }
            });
            
            video.addEventListener('error', (error) => {
                cleanup();
                reject(error);
            });
        });
    },
    
    /**
     * Handle stream ended event (user closed window/app)
     * Auto-cleanup and turn off toggle
     */
    handleStreamEnded() {
        this.cleanup();
        // Auto-toggle off since stream ended
        if (Tools.screenshareEnabled) {
            Tools.toggleScreenshare();
        }
    },
    
    /**
     * Aggressive cleanup - stop all streams, intervals, and clear references
     * Called on toggle OFF or stream failure
     */
    cleanup() {
        console.log('Cleaning up screenshare...');
        
        // Clear interval
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }
        
        // Stop stream tracks
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
            });
            this.stream = null;
        }
        
        // Clear screenshot data
        if (this.currentScreenshot) {
            this.currentScreenshot = null;
        }
        
        // Hide preview container
        if (this.previewContainer) {
            this.previewContainer.style.display = 'none';
        }
        
        // Clear preview image
        if (this.previewImage) {
            this.previewImage.src = '';
        }
        
        // Clear references
        this.previewContainer = null;
        this.previewImage = null;
        this.isActive = false;
        
        console.log('Screenshare cleanup completed');
    }
};