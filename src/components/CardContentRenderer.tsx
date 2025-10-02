import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable, ScrollView, Dimensions, useWindowDimensions } from 'react-native';
import RenderHtml from 'react-native-render-html';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
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
    if (__DEV__) {
      console.log('[CardContentRenderer] Parsing HTML:', htmlString.substring(0, 200));
    }
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

    // Parse HTML while preserving formatting tags
    // Whitelist: b, strong, i, em, u, mark, code
    let textContent = processedHtml
      .replace(/<img[^>]+>/gi, '') // Remove img tags
      .replace(/\[sound:[^\]]+\]/gi, '') // Remove sound tags
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      // Preserve formatting by converting to markers
      .replace(/<(b|strong)>/gi, '**')
      .replace(/<\/(b|strong)>/gi, '**')
      .replace(/<(i|em)>/gi, '*')
      .replace(/<\/(i|em)>/gi, '*')
      .replace(/<u>/gi, '_')
      .replace(/<\/u>/gi, '_')
      .replace(/<mark>/gi, '▐')
      .replace(/<\/mark>/gi, '▐')
      .replace(/<code>/gi, '`')
      .replace(/<\/code>/gi, '`')
      // Remove other HTML tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    
    if (__DEV__ && (textContent.includes('**') || textContent.includes('*') || textContent.includes('_') || textContent.includes('▐') || textContent.includes('`'))) {
      console.log('[CardContentRenderer] Formatted text detected:', textContent.substring(0, 100));
    }

    // Clean up extra newlines
    textContent = textContent.replace(/\n{3,}/g, '\n\n').trim();

    // Calculate available space and optimal layout
    const hasText = textContent.length > 0;
    const hasImages = images.length > 0;
    const hasAudio = audioFiles.length > 0;
    
    // Dynamic text sizing based on content length
    const wordCount = hasText ? textContent.trim().split(/\s+/).length : 0;
    const charCount = textContent.length;
    
    let fontSize = 18;
    let lineHeight = 28;
    
    if (hasText && !hasImages) {
      // Text-only card - scale dramatically based on length
      if (wordCount === 1) {
        // Single word - HUGE
        fontSize = Math.min(120, SCREEN_WIDTH * 0.15);
        lineHeight = fontSize * 1.2;
      } else if (wordCount <= 3) {
        // 2-3 words - Very large
        fontSize = Math.min(80, SCREEN_WIDTH * 0.12);
        lineHeight = fontSize * 1.2;
      } else if (wordCount <= 10) {
        // Short phrase - Large
        fontSize = Math.min(48, SCREEN_WIDTH * 0.08);
        lineHeight = fontSize * 1.3;
      } else if (wordCount <= 30) {
        // Medium text - Medium
        fontSize = 32;
        lineHeight = 44;
      } else if (wordCount <= 60) {
        // Longer text - Normal
        fontSize = 24;
        lineHeight = 34;
      } else {
        // Very long text - Compact
        fontSize = 18;
        lineHeight = 26;
      }
    } else if (hasText && hasImages) {
      // Mixed content - keep text smaller
      fontSize = charCount < 50 ? 24 : 18;
      lineHeight = fontSize * 1.4;
    }
    
    // Estimate space needed for each element type
    const audioHeight = hasAudio ? audioFiles.length * 60 : 0;
    const paddingAndGaps = 80;
    
    // Calculate available height for images
    const cardHeight = SCREEN_HEIGHT * 0.8 * 0.8;
    const estimatedTextHeight = hasText ? (textContent.length / 40) * lineHeight : 0;
    const availableImageHeight = cardHeight - estimatedTextHeight - audioHeight - paddingAndGaps;
    
    // Determine image size based on content
    let imageHeight = 300;
    if (hasImages && !hasText && !hasAudio) {
      // Image only - maximize to fill card
      imageHeight = Math.min(availableImageHeight, SCREEN_HEIGHT * 0.7);
    } else if (hasImages && (hasText || hasAudio)) {
      // Mixed content - balance
      imageHeight = Math.min(availableImageHeight * 0.7, 400);
    }

    // Parse and render formatted text
    const renderFormattedText = (text: string) => {
      const parts: React.ReactNode[] = [];
      let currentIndex = 0;
      let partKey = 0;
      
      // Simple state machine to track formatting
      const segments: Array<{ text: string; bold?: boolean; italic?: boolean; underline?: boolean; highlight?: boolean; code?: boolean }> = [];
      let currentText = '';
      let bold = false;
      let italic = false;
      let underline = false;
      let highlight = false;
      let code = false;
      
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        
        if (char === '*' && nextChar === '*') {
          // Toggle bold
          if (currentText) segments.push({ text: currentText, bold, italic, underline, highlight, code });
          currentText = '';
          bold = !bold;
          i++; // Skip next *
        } else if (char === '*') {
          // Toggle italic
          if (currentText) segments.push({ text: currentText, bold, italic, underline, highlight, code });
          currentText = '';
          italic = !italic;
        } else if (char === '_') {
          // Toggle underline
          if (currentText) segments.push({ text: currentText, bold, italic, underline, highlight, code });
          currentText = '';
          underline = !underline;
        } else if (char === '▐') {
          // Toggle highlight
          if (currentText) segments.push({ text: currentText, bold, italic, underline, highlight, code });
          currentText = '';
          highlight = !highlight;
        } else if (char === '`') {
          // Toggle code
          if (currentText) segments.push({ text: currentText, bold, italic, underline, highlight, code });
          currentText = '';
          code = !code;
        } else {
          currentText += char;
        }
      }
      
      if (currentText) segments.push({ text: currentText, bold, italic, underline, highlight, code });
      
      // Return formatted text segments as nested Text components
      return segments.filter(seg => seg.text.length > 0).map((seg, idx) => {
        const style: any = {};
        
        // Apply formatting styles
        if (seg.bold) style.fontWeight = '700';
        if (seg.italic) style.fontStyle = 'italic';
        
        // For underline and other decorations, we need to be explicit
        const decorations: string[] = [];
        if (seg.underline) decorations.push('underline');
        if (decorations.length > 0) {
          style.textDecorationLine = decorations.join(' ');
        }
        
        if (seg.highlight) { 
          style.backgroundColor = '#FFEB3B'; 
          style.color = '#000';
        }
        
        if (seg.code) { 
          style.fontFamily = 'Courier'; 
          style.backgroundColor = 'rgba(128,128,128,0.2)'; 
        }
        
        return <Text key={idx} style={style}>{seg.text}</Text>;
      });
    };

    // Only add text if there's actual content
    if (hasText) {
      const baseWeight = wordCount <= 3 ? '700' : wordCount <= 10 ? '600' : '400';
      const formattedContent = renderFormattedText(textContent);
      
      // If we have formatted segments, wrap them in a container View-like Text
      // Otherwise just render plain text
      elements.push(
        <Text
          key={key++}
          style={[
            styles.text, 
            { 
              color: theme.colors.textPrimary, 
              textAlign: 'center',
              fontSize,
              lineHeight,
              // Only set base weight if no formatting, otherwise let children handle it
              ...(formattedContent.length === 1 ? { fontWeight: baseWeight } : {}),
            }
          ]}
        >
          {formattedContent}
        </Text>
      );
    }

    // Add images with calculated height
    images.forEach(({ src }) => {
      const mediaPath = `${FileSystem.documentDirectory}media/${src}`;
      if (__DEV__) {
        console.log('[CardContentRenderer] Loading image from:', mediaPath);
      }
      elements.push(
        <View key={key++} style={styles.imageContainer}>
          <Image
            source={{ uri: mediaPath }}
            style={[styles.image, { height: imageHeight }]}
            resizeMode="contain"
            onError={(error) => {
              if (__DEV__) {
                console.error('[CardContentRenderer] Image load error:', error.nativeEvent.error);
              }
            }}
            onLoad={() => {
              if (__DEV__) {
                console.log('[CardContentRenderer] Image loaded successfully:', src);
              }
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
 * Premium audio player component - minimalistic and elegant
 */
function AudioPlayer({ filename, theme }: { filename: string; theme: any }) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Set audio mode and preload sound on mount
  React.useEffect(() => {
    const initAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        
        const mediaPath = `${FileSystem.documentDirectory}media/${filename}`;
        console.log('[AudioPlayer] Attempting to load:', filename);
        console.log('[AudioPlayer] Full path:', mediaPath);
        
        // Check if file exists
        const fileInfo = await FileSystem.getInfoAsync(mediaPath);
        console.log('[AudioPlayer] File info:', fileInfo);
        
        if (!fileInfo.exists) {
          console.error('[AudioPlayer] File does not exist:', filename);
          return;
        }
        
        // Log file extension to check format
        const ext = filename.split('.').pop()?.toLowerCase();
        console.log('[AudioPlayer] File format:', ext);
        
        // iOS supports: mp3, m4a, aac, wav, aiff, caf
        const supportedFormats = ['mp3', 'm4a', 'aac', 'wav', 'aiff', 'caf'];
        if (ext && !supportedFormats.includes(ext)) {
          console.warn('[AudioPlayer] Potentially unsupported format:', ext);
          console.warn('[AudioPlayer] Supported formats:', supportedFormats.join(', '));
        }
        
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
        console.log('[AudioPlayer] ✅ Sound loaded successfully:', filename);
      } catch (error: any) {
        console.error('[AudioPlayer] ❌ Error loading audio file:', filename);
        console.error('[AudioPlayer] Error details:', error?.message || error);
        console.error('[AudioPlayer] Error code:', error?.code);
        // Don't crash - just log and continue without audio
      }
    };
    initAudio();
  }, [filename]);

  const togglePlayPause = async () => {
    try {
      if (!sound) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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
      // Consume tap to prevent card flip
    });

  return (
    <GestureDetector gesture={audioTapGesture}>
      <View style={[styles.audioPlayerContainer, { borderColor: theme.colors.textPrimary + '10' }]}>
        {/* Play/Pause Button */}
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            togglePlayPause();
          }}
          disabled={!sound}
        >
          <View 
            style={[
              styles.playButton, 
              { 
                backgroundColor: theme.colors.textPrimary + '08',
                opacity: sound ? 1 : 0.3,
              }
            ]}
          >
            <Ionicons 
              name={isPlaying ? 'pause' : 'play'} 
              size={20} 
              color={theme.colors.textPrimary}
            />
          </View>
        </Pressable>

        {/* Progress and Info */}
        <View style={styles.audioInfo}>
          {/* Progress Bar */}
          <View style={[styles.progressTrack, { backgroundColor: theme.colors.textPrimary + '10' }]}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  backgroundColor: theme.colors.textPrimary + '40',
                  width: `${progress * 100}%`,
                }
              ]} 
            />
          </View>

          {/* Time Display */}
          <View style={styles.timeRow}>
            <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
              {formatTime(position)}
            </Text>
            <Text style={[styles.timeText, { color: theme.colors.textTertiary }]}>
              {formatTime(duration)}
            </Text>
          </View>
        </View>
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
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: s.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 14,
    fontWeight: '600',
  },
  audioInfo: {
    flex: 1,
    gap: 6,
  },
  progressTrack: {
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 10,
    fontWeight: '500',
  },
});
