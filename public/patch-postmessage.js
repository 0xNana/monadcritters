/**
 * This script patches the Window.postMessage method to handle null origins
 * which can cause errors with AppKit's contentScript.ts module
 */
(function() {
  try {
    // Store the original postMessage function
    const originalPostMessage = window.postMessage;
    
    // Override postMessage to handle null origins
    window.postMessage = function() {
      try {
        // If targetOrigin is null or undefined, use * as a fallback
        if (arguments.length > 1 && (arguments[1] === null || arguments[1] === undefined)) {
          console.debug('Patching null targetOrigin in postMessage');
          arguments[1] = '*';
        }
        return originalPostMessage.apply(this, arguments);
      } catch (e) {
        console.warn('Patched postMessage error:', e);
        return undefined;
      }
    };
    
    console.debug('Applied global postMessage patch for null origins');
    
    // Also patch any iframe contentWindow.postMessage methods
    function patchIframes() {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        try {
          if (iframe.contentWindow && iframe.contentWindow.postMessage) {
            const originalIframePostMessage = iframe.contentWindow.postMessage;
            iframe.contentWindow.postMessage = function() {
              try {
                if (arguments.length > 1 && (arguments[1] === null || arguments[1] === undefined)) {
                  arguments[1] = '*';
                }
                return originalIframePostMessage.apply(this, arguments);
              } catch (e) {
                console.warn('Patched iframe postMessage error:', e);
                return undefined;
              }
            };
          }
        } catch (error) {
          // Ignore cross-origin errors
        }
      });
    }
    
    // Patch iframes on load
    window.addEventListener('load', patchIframes);
    
    // Patch iframes when DOM changes
    const observer = new MutationObserver(function(mutations) {
      patchIframes();
    });
    
    // Start observing the document
    observer.observe(document, { 
      childList: true, 
      subtree: true 
    });
    
  } catch (error) {
    console.error('Failed to patch postMessage:', error);
  }
})(); 