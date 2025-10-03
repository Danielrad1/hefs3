import React, { useState } from 'react';
import { View, Text as RNText, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import RenderHtml from 'react-native-render-html';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '../design/theme';
import { s } from '../design/spacing';
import { r } from '../design/radii';

interface CardContentRendererProps {
  html: string;
  revealed?: boolean;
  clozeIndex?: number;
  cardId?: string;
}

/**
 * Renders Anki card HTML content properly with full HTML support:
 * - Lists (ol, ul)
 * - Code blocks (pre, code)
 * - Formatting (b, i, u, strong, em)
 * - Line breaks and paragraphs
 * - Images
 * - Audio files
 * - Cloze deletions
 */
export default function CardContentRendererV2({
  html,
  revealed = false,
  clozeIndex = 0,
  cardId = '',
}: CardContentRendererProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  // Memoize audio extraction based on HTML content
  const audioFiles = React.useMemo(() => {
    const extractedAudio: string[] = [];
    const audioRegex = /\[sound:([^\]]+)\]/gi;
    let audioMatch;
    while ((audioMatch = audioRegex.exec(html)) !== null) {
      extractedAudio.push(audioMatch[1]);
    }
    return extractedAudio;
  }, [html]);

  // Process HTML for cloze deletions and extract audio
  const processedHtml = React.useMemo(() => {
    let processed = html;

    // Handle cloze deletions: {{c1::text}} or {{c1::text::hint}}
    const clozeRegex = /{{c(\d+)::([^:}]+)(?:::([^}]+))?}}/gi;
    processed = processed.replace(clozeRegex, (match, num, text, hint) => {
      const clozeNum = parseInt(num);

      if (clozeNum === clozeIndex + 1) {
        // This is the cloze we're testing
        if (revealed) {
          return `<span style="color: #4CAF50; font-weight: bold; background-color: rgba(76, 175, 80, 0.1); padding: 2px 6px; border-radius: 4px;">${text}</span>`;
        } else {
          return `<span style="color: #2196F3; font-weight: bold; background-color: rgba(33, 150, 243, 0.1); padding: 2px 6px; border-radius: 4px;">[...]</span>`;
        }
      } else {
        // Other clozes - show the text
        return `<span style="color: ${theme.colors.textPrimary};">${text}</span>`;
      }
    });

    // Remove audio tags from HTML
    const audioRegex = /\[sound:([^\]]+)\]/gi;
    processed = processed.replace(audioRegex, '');

    // Fix image sources to point to local media directory
    processed = processed.replace(
      /<img([^>]+)src="([^"]+)"([^>]*)>/gi,
      (match, before, src, after) => {
        const mediaPath = `${FileSystem.documentDirectory}media/${src}`;
        return `<img${before}src="${mediaPath}"${after}>`;
      }
    );

    return processed;
  }, [html, revealed, clozeIndex, theme.colors.textPrimary]);

  // Calculate dynamic font size based on content length
  const textContent = processedHtml.replace(/<[^>]+>/g, '').trim();
  const wordCount = textContent.split(/\s+/).length;
  const charCount = textContent.length;
  
  let baseFontSize = 18;
  let baseLineHeight = 28;
  
  // Dynamic sizing based on content length (like the old renderer)
  if (wordCount === 1) {
    baseFontSize = Math.min(120, width * 0.15);
    baseLineHeight = baseFontSize * 1.2;
  } else if (wordCount <= 3) {
    baseFontSize = Math.min(80, width * 0.12);
    baseLineHeight = baseFontSize * 1.2;
  } else if (wordCount <= 10) {
    baseFontSize = Math.min(48, width * 0.08);
    baseLineHeight = baseFontSize * 1.3;
  } else if (wordCount <= 30) {
    baseFontSize = 32;
    baseLineHeight = 44;
  } else if (wordCount <= 60) {
    baseFontSize = 24;
    baseLineHeight = 34;
  } else {
    baseFontSize = 18;
    baseLineHeight = 26;
  }

  // Custom renderers for specific HTML elements
  const tagsStyles = {
    body: {
      color: theme.colors.textPrimary,
      fontSize: baseFontSize,
      lineHeight: baseLineHeight,
      textAlign: 'center' as const,
      fontWeight: wordCount <= 3 ? '700' as const : wordCount <= 10 ? '600' as const : '400' as const,
    },
    p: {
      marginVertical: 8,
    },
    strong: {
      fontWeight: '700' as const,
    },
    b: {
      fontWeight: '700' as const,
    },
    em: {
      fontStyle: 'italic' as const,
    },
    i: {
      fontStyle: 'italic' as const,
    },
    u: {
      textDecorationLine: 'underline' as const,
    },
    code: {
      fontFamily: 'Courier',
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      fontSize: 16,
    },
    pre: {
      backgroundColor: theme.colors.surface,
      padding: 12,
      borderRadius: 8,
      marginVertical: 8,
      fontFamily: 'Courier',
      fontSize: 14,
      lineHeight: 20,
    },
    ol: {
      marginVertical: 8,
      paddingLeft: 20,
    },
    ul: {
      marginVertical: 8,
      paddingLeft: 20,
    },
    li: {
      marginVertical: 4,
      fontSize: 18,
      lineHeight: 26,
    },
    h1: {
      fontSize: 32,
      fontWeight: '700' as const,
      marginVertical: 12,
    },
    h2: {
      fontSize: 28,
      fontWeight: '700' as const,
      marginVertical: 10,
    },
    h3: {
      fontSize: 24,
      fontWeight: '600' as const,
      marginVertical: 8,
    },
    blockquote: {
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.accent,
      paddingLeft: 12,
      marginVertical: 8,
      fontStyle: 'italic' as const,
      opacity: 0.8,
    },
    img: {
      marginVertical: 12,
    },
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <RenderHtml
        contentWidth={width - s.lg * 2}
        source={{ html: processedHtml }}
        tagsStyles={tagsStyles as any}
        defaultTextProps={{
          selectable: false,
        }}
        enableExperimentalMarginCollapsing
        renderersProps={{
          img: {
            enableExperimentalPercentWidth: true,
          },
        }}
      />

      {/* Audio Players */}
      {audioFiles.map((filename, index) => (
        <AudioPlayer key={`${cardId}-${filename}-${index}`} filename={filename} theme={theme} cardId={cardId} />
      ))}
    </View>
  );
}

/**
 * Audio player component - Anki style with progress bar
 */
function AudioPlayer({ filename, theme, cardId }: { filename: string; theme: any; cardId: string }) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  // Preload sound on mount
  React.useEffect(() => {
    const initAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });

        const mediaPath = `${FileSystem.documentDirectory}media/${filename}`;
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: mediaPath },
          { shouldPlay: false },
          (status) => {
            if (status.isLoaded) {
              setIsPlaying(status.isPlaying);
              setPosition(status.positionMillis || 0);
              setDuration(status.durationMillis || 0);
              
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPosition(0);
              }
            }
          }
        );

        setSound(newSound);
      } catch (error) {
        console.error('[AudioPlayer] Error loading audio:', error);
      }
    };

    initAudio();
  }, [filename]);

  // Cleanup on unmount or when card/filename changes
  React.useEffect(() => {
    return () => {
      if (sound) {
        sound.stopAsync()
          .then(() => sound.unloadAsync())
          .catch((e) => console.error('[AudioPlayer] Cleanup error:', e));
      }
    };
  }, [filename, sound, cardId]);

  const togglePlayPause = async () => {
    try {
      if (!sound) return;

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
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

  const handleReplay = async (e: any) => {
    e.stopPropagation();
    try {
      if (!sound) return;

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      await sound.setPositionAsync(0);
      await sound.playAsync();
      setIsPlaying(true);
    } catch (error) {
      console.error('[AudioPlayer] Error replaying:', error);
    }
  };

  const formatTime = (millis: number) => {
    const seconds = Math.floor(millis / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? position / duration : 0;

  // Create a tap gesture that blocks the parent card's tap gesture
  const audioTapGesture = Gesture.Tap()
    .onEnd(() => {
      // Consume tap to prevent card flip
    });

  return (
    <GestureDetector gesture={audioTapGesture}>
      <View style={[styles.audioPlayer, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.audioControls}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
            disabled={!sound}
          >
            <View style={[styles.playButton, { backgroundColor: theme.colors.accent, opacity: sound ? 1 : 0.3 }]}>
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={20}
                color="#000"
                style={isPlaying ? {} : { marginLeft: 2 }}
              />
            </View>
          </Pressable>

          <Pressable
            onPress={handleReplay}
            disabled={!sound}
            style={styles.replayButton}
          >
            <Ionicons
              name="reload"
              size={18}
              color={theme.colors.textSecondary}
              style={{ opacity: sound ? 1 : 0.3 }}
            />
          </Pressable>
        </View>
        
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  backgroundColor: theme.colors.accent,
                  width: `${progress * 100}%`,
                }
              ]} 
            />
          </View>
          {duration > 0 && (
            <View style={styles.timeContainer}>
              <RNText style={[styles.timeText, { color: theme.colors.textSecondary }]}>
                {formatTime(position)} / {formatTime(duration)}
              </RNText>
            </View>
          )}
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: s.lg,
  },
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s.md,
    borderRadius: r.md,
    marginTop: s.md,
    gap: s.sm,
    minWidth: 280,
  },
  audioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    flex: 1,
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
  timeContainer: {
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
