import React, { useState, useLayoutEffect } from 'react';
import { View, Text as RNText, StyleSheet, Pressable, useWindowDimensions, Image } from 'react-native';
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
  const { width, height } = useWindowDimensions();
  
  // State to prevent rendering until dimensions are calculated
  const [isReady, setIsReady] = useState(false);
  
  // Memoize content analysis to prevent recalculation on every render
  const contentAnalysis = React.useMemo(() => {
    const hasImages = /<img[^>]+>/i.test(html);
    const textContent = html.replace(/<[^>]+>/g, '').trim();
    const wordCount = textContent.split(/\s+/).length;
    const charCount = textContent.length;
    
    // Calculate available space based on actual card dimensions
    const cardHeight = height * 0.8; // Card takes 80% of screen height  
    const cardWidth = width - (s.lg * 2); // Card width minus screen padding
    const cardPadding = s.md * 2; // Top and bottom card padding
    
    // Dynamic text space based on actual content - use more of the available space
    const estimatedTextSpace = wordCount <= 3 ? 20 : // Less space for short text
                               wordCount <= 8 ? 35 : 
                               wordCount <= 20 ? 50 : 70;
    const margins = wordCount <= 3 ? 10 : 25; // Reduced margins to use more space
    const availableHeight = cardHeight - cardPadding - estimatedTextSpace - margins;
    
    // Image width should be more conservative - not full card width
    const maxImageWidth = cardWidth * 0.85; // 85% of card width, not 100%
    
    return {
      hasImages,
      textContent,
      wordCount,
      charCount,
      cardHeight,
      cardWidth,
      availableHeight,
      maxImageWidth
    };
  }, [html, width, height]);
  
  const { hasImages, textContent, wordCount, charCount, availableHeight, maxImageWidth } = contentAnalysis;
  
  // Use layout effect to ensure dimensions are ready before rendering
  useLayoutEffect(() => {
    if (width > 0 && height > 0) {
      setIsReady(true);
    }
  }, [width, height]); // Don't reset on cardId change - dimensions don't change
  
  // Calculate sizing ONCE on mount, don't recalculate on reveal
  // This keeps text size constant when flipping cards
  const sizingConfig = React.useMemo(() => {
    let imageHeight: number;
    let fontSize: number = 16;
    
    if (hasImages) {
      // Fixed image height - doesn't try to fit in available space
      imageHeight = 300; // Standard image height
      
      // Font size based on word count only
      if (wordCount <= 3) {
        fontSize = Math.min(32, width * 0.08);
      } else if (wordCount <= 10) {
        fontSize = Math.min(26, width * 0.065);
      } else if (wordCount <= 30) {
        fontSize = 20;
      } else if (wordCount <= 60) {
        fontSize = 16;
      } else {
        fontSize = 14;
      }
    } else {
      imageHeight = 0;
      if (wordCount === 1) {
        fontSize = Math.min(120, width * 0.15);
      } else if (wordCount <= 3) {
        fontSize = Math.min(80, width * 0.12);
      } else if (wordCount <= 10) {
        fontSize = Math.min(48, width * 0.08);
      } else if (wordCount <= 30) {
        fontSize = 32;
      } else if (wordCount <= 60) {
        fontSize = 24;
      } else {
        fontSize = 18;
      }
    }
    
    return {
      maxImageHeight: imageHeight,
      baseFontSize: fontSize,
      baseLineHeight: fontSize * 1.3
    };
  }, [hasImages, wordCount, width]); // Removed height and availableHeight - don't resize based on space

  const { maxImageHeight, baseFontSize, baseLineHeight } = sizingConfig;

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
        // Sanitize filename the same way it was saved during import
        // Replace unsafe characters with underscore (matches ApkgParser.sanitizeFilename)
        let sanitized = src.replace(/[^A-Za-z0-9._-]/g, '_');
        
        // URL encode for the file path
        const encodedFilename = encodeURIComponent(sanitized);
        const mediaPath = `${FileSystem.documentDirectory}media/${encodedFilename}`;
        return `<img${before}src="${mediaPath}"${after}>`;
      }
    );

    return processed;
  }, [html, revealed, clozeIndex, theme.colors.textPrimary]);

  // Custom renderers for specific HTML elements
  const tagsStyles = React.useMemo(() => ({
    body: {
      color: theme.colors.textPrimary,
      fontSize: baseFontSize,
      lineHeight: baseLineHeight,
      textAlign: 'center' as const,
      fontWeight: hasImages && wordCount <= 3 ? '700' as const : // Bold for minimal text with images
                  hasImages && wordCount <= 8 ? '600' as const : 
                  wordCount <= 3 ? '700' as const : 
                  wordCount <= 10 ? '600' as const : '400' as const,
    },
    p: {
      marginVertical: hasImages && wordCount <= 3 ? 2 : // Minimal margins for short text
                     hasImages ? 4 : 8,
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
      marginVertical: hasImages && wordCount <= 3 ? 2 : 
                     hasImages && wordCount <= 8 ? 4 : 6, // Tighter margins for better fit
      maxWidth: maxImageWidth, // 85% of card width, not full width
      maxHeight: maxImageHeight, // Dynamic height limit based on screen size
      minHeight: hasImages ? 
        (wordCount <= 3 ? Math.min(200, maxImageHeight * 0.6) : // Larger minimum for minimal text
         wordCount <= 8 ? Math.min(150, maxImageHeight * 0.5) : 
         Math.min(100, maxImageHeight * 0.3)) : undefined,
      width: 'auto',
      height: 'auto',
      alignSelf: 'center',
      objectFit: 'contain', // Maintain aspect ratio
    },
  }), [theme.colors, baseFontSize, baseLineHeight, hasImages, wordCount, maxImageWidth, maxImageHeight]);

  // Memoize renderersProps to prevent layout shifts
  const renderersProps = React.useMemo(() => ({
    img: {
      enableExperimentalPercentWidth: true,
      initialDimensions: {
        width: maxImageWidth,
        height: maxImageHeight,
      },
      computeEmbeddedMaxWidth: (availableWidth: number) => {
        return Math.min(availableWidth, maxImageWidth);
      },
      computeEmbeddedMaxHeight: (availableHeight: number) => {
        return Math.min(availableHeight, maxImageHeight);
      },
    },
  }), [maxImageWidth, maxImageHeight]);

  // Don't render until dimensions are stable
  if (!isReady) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      <RenderHtml
        contentWidth={maxImageWidth}
        source={{ html: processedHtml }}
        tagsStyles={tagsStyles as any}
        defaultTextProps={{
          selectable: false,
        }}
        enableExperimentalMarginCollapsing
        renderersProps={renderersProps}
        ignoredDomTags={['font']}
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
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: s.lg,
    minHeight: '100%',
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
