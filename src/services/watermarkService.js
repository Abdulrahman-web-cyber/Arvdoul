// src/services/watermarkService.js
// 🎬 ENTERPRISE VIDEO WATERMARK SERVICE

class WatermarkService {
  static async addWatermarkToVideo(videoFile, watermarkText = 'Arvdoul', username = null) {
    return new Promise((resolve, reject) => {
      try {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(videoFile);
        
        video.onloadedmetadata = () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          
          // Draw video frame
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Add main watermark
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.font = `bold ${Math.min(canvas.width, canvas.height) / 15}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(watermarkText, canvas.width / 2, canvas.height / 2);
          
          // Add username watermark if provided
          if (username) {
            ctx.font = `${Math.min(canvas.width, canvas.height) / 30}px Arial`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`@${username}`, canvas.width - 20, canvas.height - 20);
          }
          
          // Add logo watermark
          const logo = new Image();
          logo.onload = () => {
            const logoSize = Math.min(canvas.width, canvas.height) / 8;
            ctx.drawImage(
              logo,
              20,
              canvas.height - logoSize - 20,
              logoSize,
              logoSize
            );
            
            canvas.toBlob((blob) => {
              if (!blob) {
                reject(new Error('Failed to create watermarked video'));
                return;
              }
              
              const watermarkedFile = new File([blob], `watermarked_${videoFile.name}`, {
                type: 'image/png',
                lastModified: Date.now()
              });
              
              resolve(watermarkedFile);
            }, 'image/png');
          };
          
          logo.src = '/public/icons/icon.png';
        };
        
        video.onerror = () => reject(new Error('Failed to load video'));
      } catch (error) {
        reject(error);
      }
    });
  }
  
  static async addWatermarkToImage(imageFile, watermarkText = 'Arvdoul') {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.src = URL.createObjectURL(imageFile);
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          
          // Draw image
          ctx.drawImage(img, 0, 0);
          
          // Add watermark in bottom-right corner
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.font = '20px Arial';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillText(watermarkText, canvas.width - 10, canvas.height - 10);
          
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to create watermarked image'));
              return;
            }
            
            const watermarkedFile = new File([blob], `watermarked_${imageFile.name}`, {
              type: 'image/png',
              lastModified: Date.now()
            });
            
            resolve(watermarkedFile);
          }, 'image/png');
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
      } catch (error) {
        reject(error);
      }
    });
  }
}

export default WatermarkService;