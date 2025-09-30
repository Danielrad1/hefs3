import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '../design/theme';
import { s } from '../design/spacing';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CardContentRendererProps {
  html: string;
  revealed?: boolean;
  clozeIndex?: number; // For cloze cards, which cloze to show
  cardId?: string; // Unique card ID to force remount on card change
}

/**
 * Renders Anki card HTML content with support for:
 * - Images
 * - Audio files
 * - Cloze deletions
 * - Basic HTML formatting
 */
export default function CardContentRenderer({ 
  html, 
  revealed = false,
  clozeIndex = 0,
  cardId = ''
}: CardContentRendererProps) {
  const theme = useTheme();

  // Parse HTML and extract media references
  const parseContent = (htmlString: string) => {
    console.log('[CardContentRenderer] Parsing HTML:', htmlString.substring(0, 200));
    const elements: React.ReactNode[] = [];
    let key = 0;

    // Extract images: <img src="filename.jpg">
    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
    // Extract audio: [sound:filename.mp3]
    const audioRegex = /\[sound:([^\]]+)\]/gi;
    // Extract cloze: {{c1::text}} or {{c1::text::hint}}
    const clozeRegex = /{{c(\d+)::([^:}]+)(?:::([^}]+))?}}/gi;

    let match;

    // Process the HTML string
    let processedHtml = htmlString;

    // Handle cloze deletions
    processedHtml = processedHtml.replace(clozeRegex, (match, num, text, hint) => {
      const clozeNum = parseInt(num);
      
      if (clozeNum === clozeIndex + 1) {
        // This is the cloze we're testing
        if (revealed) {
          return `<span style="color: #4CAF50; font-weight: bold;">${text}</span>`;
        } else {
          return `<span style="color: #2196F3; font-weight: bold;">[...]</span>`;
        }
      } else {
        // Other clozes are always shown
        return text;
      }
    });

    // Extract images BEFORE removing HTML
    const images: Array<{ index: number; src: string }> = [];
    while ((match = imgRegex.exec(htmlString)) !== null) {
      images.push({ index: match.index, src: match[1] });
    }

    // Extract audio BEFORE removing HTML
    const audioFiles: Array<{ index: number; filename: string }> = [];
    while ((match = audioRegex.exec(htmlString)) !== null) {
      audioFiles.push({ index: match.index, filename: match[1] });
    }

    // Remove image and audio tags from text content
    let textContent = processedHtml
      .replace(/<img[^>]+>/gi, '') // Remove img tags
      .replace(/\[sound:[^\]]+\]/gi, '') // Remove sound tags
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');

    // Clean up extra newlines
    textContent = textContent.replace(/\n{3,}/g, '\n\n').trim();

    // Calculate available space and optimal layout
    const hasText = textContent.length > 0;
    const hasImages = images.length > 0;
    const hasAudio = audioFiles.length > 0;
    
    // Estimate space needed for each element type
    const textHeight = hasText ? Math.min(textContent.length * 0.5, 150) : 0; // Rough estimate
    const audioHeight = hasAudio ? audioFiles.length * 60 : 0;
    const paddingAndGaps = 80; // Account for padding and gaps
    
    // Calculate available height for images (80% of card height)
    const cardHeight = SCREEN_HEIGHT * 0.8 * 0.8; // 80% of screen, 80% of card
    const availableImageHeight = cardHeight - textHeight - audioHeight - paddingAndGaps;
    
    // Determine image size based on content
    let imageHeight = 300; // Default
    if (hasImages && !hasText && !hasAudio) {
      // Image only - maximize
      imageHeight = Math.min(availableImageHeight, SCREEN_WIDTH * 0.85 * 1.5); // Max 1.5x width
    } else if (hasImages && (hasText || hasAudio)) {
      // Mixed content - balance
      imageHeight = Math.min(availableImageHeight, 350);
    }

    // Only add text if there's actual content
    if (hasText) {
      elements.push(
        <Text
          key={key++}
          style={[styles.text, { color: theme.colors.textPrimary, textAlign: 'center' }]}
        >
          {textContent}
        </Text>
      );
    }

    // Add images with calculated height
    images.forEach(({ src }) => {
      const mediaPath = `${FileSystem.documentDirectory}media/${src}`;
      console.log('[CardContentRenderer] Loading image from:', mediaPath);
      elements.push(
        <View key={key++} style={styles.imageContainer}>
          <Image
            source={{ uri: mediaPath }}
            style={[styles.image, { height: imageHeight }]}
            resizeMode="contain"
            onError={(error) => {
              console.error('[CardContentRenderer] Image load error:', error.nativeEvent.error);
            }}
            onLoad={() => {
              console.log('[CardContentRenderer] Image loaded successfully:', src);
            }}
          />
        </View>
      );
    });

    // Add audio players with unique key to force remount
    audioFiles.forEach(({ filename }) => {
      elements.push(
        <AudioPlayer
          key={`${cardId}-${filename}-${key++}`}
          filename={filename}
          theme={theme}
        />
      );
    });

    return elements;
  };

  const content = parseContent(html);
  
  return (
    <View style={styles.container} pointerEvents="box-none">
      {content}
    </View>
  );
}

/**
 * Professional audio player component with progress bar
 */
function AudioPlayer({ filename, theme }: { filename: string; theme: any }) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Set audio mode and preload sound on mount
  React.useEffect(() => {
    const initAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        setIsInitialized(true);
        
        // Preload sound immediately for instant playback
        const mediaPath = `${FileSystem.documentDirectory}media/${filename}`;
        console.log('[AudioPlayer] Preloading sound from:', mediaPath);
        
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: mediaPath },
          { shouldPlay: false },
          (status) => {
            if (status.isLoaded) {
              setIsPlaying(status.isPlaying);
              setPosition(status.positionMillis);
              setDuration(status.durationMillis || 0);
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPosition(0);
              }
            }
          }
        );
        
        setSound(newSound);
        console.log('[AudioPlayer] Sound preloaded successfully:', filename);
      } catch (error) {
        console.error('[AudioPlayer] Error initializing audio:', error);
      }
    };
    initAudio();
  }, [filename]);

  const loadSound = async () => {
    try {
      if (!isInitialized) {
        console.log('[AudioPlayer] Audio not initialized yet');
        return null;
      }

      // Clean up existing sound first
      if (sound) {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
          setSound(null);
        } catch (e) {
          console.error('[AudioPlayer] Error cleaning up old sound:', e);
        }
      }

      setIsLoading(true);
      const mediaPath = `${FileSystem.documentDirectory}media/${filename}`;
      console.log('[AudioPlayer] Loading sound from:', mediaPath);
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: mediaPath },
        { shouldPlay: false }, // NEVER autoplay
        (status) => {
          // Status update callback - but don't flip card!
          if (status.isLoaded) {
            setIsPlaying(status.isPlaying);
            setPosition(status.positionMillis);
            setDuration(status.durationMillis || 0);
            if (status.didJustFinish) {
              // Audio finished - just stop, don't propagate events
              setIsPlaying(false);
              setPosition(0);
            }
          }
        }
      );
      
      setSound(newSound);
      setIsLoading(false);
      console.log('[AudioPlayer] Sound loaded successfully:', filename);
      return newSound;
    } catch (error) {
      console.error('[AudioPlayer] Error loading sound:', error);
      setIsLoading(false);
      return null;
    }
  };

  const togglePlayPause = async () => {
    try {
      if (!sound) {
        console.log('[AudioPlayer] Sound not loaded yet');
        return;
      }

      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          console.log('[AudioPlayer] Pausing sound');
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          console.log('[AudioPlayer] Playing sound');
          // If finished, reset to beginning
          if (status.didJustFinish || status.positionMillis >= (status.durationMillis || 0)) {
            await sound.setPositionAsync(0);
          }
          await sound.playAsync();
          setIsPlaying(true);
        }
      }
    } catch (error) {
      console.error('[AudioPlayer] Error toggling playback:', error);
    }
  };

  const stopSound = async () => {
    try {
      if (sound) {
        await sound.stopAsync();
        await sound.setPositionAsync(0);
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('[AudioPlayer] Error stopping sound:', error);
    }
  };

  // Cleanup on unmount or when filename changes (card changes)
  React.useEffect(() => {
    return () => {
      console.log('[AudioPlayer] Cleaning up sound:', filename);
      if (sound) {
        sound.stopAsync()
          .then(() => sound.unloadAsync())
          .catch((e) => console.error('[AudioPlayer] Cleanup error:', e));
      }
    };
  }, [filename, sound]);

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? position / duration : 0;

  // Create a tap gesture that blocks the parent card's tap gesture
  const audioTapGesture = Gesture.Tap()
    .onEnd(() => {
      // Do nothing - just consume the tap to prevent it from reaching the card
    });

  return (
    <GestureDetector gesture={audioTapGesture}>
      <View 
        style={[styles.audioPlayerContainer, { backgroundColor: theme.colors.surface }]}
      >
      <Pressable
        style={[styles.audioButton, { backgroundColor: theme.colors.accent }]}
        onPress={(e) => {
          e.stopPropagation();
          togglePlayPause();
        }}
        disabled={!sound}
      >
        <Text style={[styles.audioText, { color: '#FFFFFF' }]}>
          {isLoading ? '⏳' : isPlaying ? '⏸' : '▶'}
        </Text>
      </Pressable>
      
      <View style={styles.audioInfo}>
        <Text style={[styles.audioFilename, { color: theme.colors.textPrimary }]} numberOfLines={1}>
          {filename}
        </Text>
        
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: theme.colors.bg }]}>
            <View 
              style={[
                styles.progressFill, 
                { backgroundColor: theme.colors.accent, width: `${progress * 100}%` }
              ]} 
            />
          </View>
          
          <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
            {formatTime(position)} / {formatTime(duration)}
          </Text>
        </View>
      </View>
      
      {sound && (
        <Pressable
          style={[styles.audioStopButton, { backgroundColor: theme.colors.bg }]}
          onPress={(e) => {
            e.stopPropagation();
            stopSound();
          }}
        >
          <Text style={[styles.audioText, { color: theme.colors.textPrimary }]}>
            ⏹
          </Text>
        </Pressable>
      )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.md,
    padding: s.md,
  },
  contentContainer: {
    gap: s.md,
    padding: s.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  text: {
    fontSize: 18,
    lineHeight: 28,
    textAlign: 'center',
    paddingHorizontal: s.sm,
  },
  imageContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    marginVertical: s.sm,
  },
  audioPlayerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
    paddingVertical: s.md,
    paddingHorizontal: s.lg,
    borderRadius: 16,
    marginVertical: s.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  audioButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  audioStopButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioText: {
    fontSize: 20,
  },
  audioInfo: {
    flex: 1,
    gap: s.xs,
  },
  audioFilename: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressContainer: {
    gap: s.xs,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
