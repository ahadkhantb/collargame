class SoundService {
  private sounds: { [key: string]: HTMLAudioElement } = {};
  private enabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      this.sounds = {
        click: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'),
        bet: new Audio('https://assets.mixkit.co/active_storage/sfx/2017/2017-preview.mp3'),
        tick: new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'),
        win: new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'),
        lose: new Audio('https://assets.mixkit.co/active_storage/sfx/251/251-preview.mp3'),
        draw: new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'),
      };

      // Preload sounds
      Object.values(this.sounds).forEach(audio => {
        audio.load();
        audio.volume = 0.4;
      });
    }
  }

  play(soundName: 'click' | 'bet' | 'tick' | 'win' | 'lose' | 'draw') {
    if (!this.enabled || !this.sounds[soundName]) return;
    
    const sound = this.sounds[soundName];
    sound.currentTime = 0;
    sound.play().catch(e => console.log('Audio play blocked:', e));
  }

  toggle(state?: boolean) {
    this.enabled = state !== undefined ? state : !this.enabled;
    return this.enabled;
  }

  isEnabled() {
    return this.enabled;
  }
}

export const soundService = new SoundService();
