// Audio notification system using Web Audio API
class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private volume: number = 0.8;

  constructor() {
    // Initialize audio context when first used to avoid autoplay issues
  }

  private async getAudioContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Resume context if it's suspended (due to browser autoplay policies)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    return this.audioContext;
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume / 100)); // Convert 0-100 to 0-1
  }

  async playChime() {
    try {
      // If volume is 0, don't play anything
      if (this.volume === 0) return;
      
      const audioContext = await this.getAudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Pleasant chime sequence
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime); // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.15); // G5
      oscillator.frequency.setValueAtTime(987.77, audioContext.currentTime + 0.3); // B5
      
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.4, audioContext.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.8);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.8);
    } catch (error) {
      console.error('Error playing chime:', error);
    }
  }


  async playNotification() {
    try {
      // If volume is 0, don't play anything
      if (this.volume === 0) return;
      
      const audioContext = await this.getAudioContext();
      const oscillator1 = audioContext.createOscillator();
      const oscillator2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Dual tone notification
      oscillator1.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator2.frequency.setValueAtTime(1000, audioContext.currentTime);
      
      oscillator1.type = 'sine';
      oscillator2.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.2, audioContext.currentTime + 0.03);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.15);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.2, audioContext.currentTime + 0.18);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.35);
      
      oscillator1.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + 0.35);
      oscillator2.start(audioContext.currentTime);
      oscillator2.stop(audioContext.currentTime + 0.35);
    } catch (error) {
      console.error('Error playing notification:', error);
    }
  }


  async playSound(soundType: string) {
    switch (soundType) {
      case 'chime':
      case 'soft chime':
        await this.playChime();
        break;
      case 'notification':
        await this.playNotification();
        break;
      default:
        console.warn(`Unknown sound type: ${soundType}, using soft chime`);
        await this.playChime(); // Default fallback
    }
  }

  // Play price drop alert with settings
  async playPriceDropAlert(settings: { enableAudio: boolean; priceDropSound: string; audioVolume: number }) {
    if (!settings.enableAudio) return;
    
    this.setVolume(settings.audioVolume);
    await this.playSound(settings.priceDropSound);
  }

  // Play stock alert with settings
  async playStockAlert(settings: { enableAudio: boolean; stockAlertSound: string; audioVolume: number }) {
    if (!settings.enableAudio) return;
    
    this.setVolume(settings.audioVolume);
    await this.playSound(settings.stockAlertSound);
  }
}

export const audioPlayer = new AudioPlayer();