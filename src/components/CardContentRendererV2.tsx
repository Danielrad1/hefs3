import React, { useState, useLayoutEffect } from 'react';
import {
  View,
  Text as RNText,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  Image,
} from 'react-native';
import RenderHtml, {
  CustomBlockRenderer,
  TBlock,
  CustomRendererProps,
  TNode,
  HTMLElementModel,
  HTMLContentModel,
} from 'react-native-render-html';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '../design/theme';
import { s } from '../design/spacing';
import { r } from '../design/radii';
import * as Haptics from 'expo-haptics';
import { ImageCache } from '../utils/ImageCache';
import { getMediaUri } from '../utils/mediaHelpers';
import { logger } from '../utils/logger';

interface CardContentRendererProps {
  html: string;
  revealed?: boolean;
  clozeIndex?: number;
  cardId?: string;
}

interface ImageOcclusionMask {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ImageOcclusionData {
  version: number;
  image: string;
  mode: 'hide-one' | 'hide-all';
  masks: ImageOcclusionMask[];
  naturalSize?: { w: number; h: number };
}

/**
 * Custom renderer for <io-occlude> elements
 * Renders image with occlusion masks as overlays
 */
const ImageOcclusionRenderer: CustomBlockRenderer = (props: any) => {
  const { tnode } = props;
  const theme = useTheme();
  const [layout, setLayout] = useState<{ width: number; height: number } | null>(null);

  // Extract attributes from the node
  const dataAttr = tnode.attributes?.data || '{}';
  const ordAttr = tnode.attributes?.ord || '0';
  const revealAttr = tnode.attributes?.reveal === 'true';

  // Get renderer props from the renderersProps passed to RenderHtml
  const revealed = props.revealed ?? revealAttr;
  const contentWidth = props.contentWidth || 300;
  const maxImageHeight = props.maxImageHeight || 400;

  // Parse occlusion data
  const occlusionData = React.useMemo<ImageOcclusionData>(() => {
    try {
      return JSON.parse(dataAttr);
    } catch (e) {
      logger.error('[ImageOcclusionRenderer] Failed to parse data:', e);
      return {
        version: 1,
        image: '',
        mode: 'hide-one',
        masks: [],
      };
    }
  }, [dataAttr]);

  const isHideAllMode = occlusionData.mode === 'hide-all';
  const ord = parseInt(ordAttr, 10);
  const masks = occlusionData.masks || [];
  // For both hide-one and hide-all, target is the mask at index ord
  const targetMask = Number.isFinite(ord) ? masks[ord] : null;
  const imageUri = getMediaUri(occlusionData.image);

  // Calculate image dimensions maintaining aspect ratio
  const [imageDimensions, setImageDimensions] = useState({ width: contentWidth, height: 300 });

  React.useEffect(() => {
    if (!occlusionData.image) {
      return;
    }

    Image.getSize(
      imageUri,
      (width, height) => {
        const aspectRatio = height / width;
        let displayWidth = contentWidth;
        let displayHeight = displayWidth * aspectRatio;

        if (displayHeight > maxImageHeight) {
          displayHeight = maxImageHeight;
          displayWidth = displayHeight / aspectRatio;
        }

        setImageDimensions({ width: displayWidth, height: displayHeight });
      },
      (error) => {
        // HEIC images often fail getSize on iOS, but we have naturalSize fallback
        logger.debug('[ImageOcclusionRenderer] Image.getSize failed (expected for HEIC), using naturalSize fallback');

        // Attempt fallback using naturalSize (stored during authoring/import)
        const natural = occlusionData.naturalSize as any;
        const naturalWidth = natural?.w ?? natural?.width;
        const naturalHeight = natural?.h ?? natural?.height;

        if (naturalWidth && naturalHeight) {
          const aspectRatio = naturalHeight / naturalWidth;
          let displayWidth = contentWidth;
          let displayHeight = displayWidth * aspectRatio;

          if (displayHeight > maxImageHeight) {
            displayHeight = maxImageHeight;
            displayWidth = displayHeight / aspectRatio;
          }

          logger.debug('[ImageOcclusionRenderer] Using naturalSize fallback for rendering', {
            width: naturalWidth,
            height: naturalHeight,
          });
          setImageDimensions({ width: displayWidth, height: displayHeight });
        } else {
          // Last resort: use square placeholder to keep layout stable
          const fallbackSize = Math.min(contentWidth, maxImageHeight);
          logger.warn(
            '[ImageOcclusionRenderer] Falling back to square placeholder size',
            fallbackSize,
          );
          setImageDimensions({ width: fallbackSize, height: fallbackSize });
        }
      },
    );
  }, [imageUri, contentWidth, maxImageHeight, occlusionData.naturalSize]);

  const handleLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  };

  return (
    <View style={[ioStyles.container, { alignSelf: 'center' }]}>
      <View
        style={{
          width: imageDimensions.width,
          height: imageDimensions.height,
          position: 'relative',
        }}
        onLayout={handleLayout}
      >
        <Image
          source={{ uri: imageUri }}
          style={{
            width: imageDimensions.width,
            height: imageDimensions.height,
          }}
          resizeMode="contain"
        />

        {/* Render masks as overlays */}
        {layout &&
          masks.map((mask, index) => {
            const isTarget = targetMask && mask.id === targetMask.id;
            const left = mask.x * layout.width;
            const top = mask.y * layout.height;
            const width = mask.w * layout.width;
            const height = mask.h * layout.height;

            let maskStyle: any;

            if (isHideAllMode) {
              // Hide-All: all masks opaque on front, target highlighted + others faint on back
              if (revealed) {
                maskStyle = isTarget ? ioStyles.highlight : ioStyles.faint;
              } else {
                maskStyle = ioStyles.opaque;
              }
            } else {
              // Hide-One: ONLY show target mask, hide all others completely
              if (revealed) {
                // Back: highlight target, hide others
                maskStyle = isTarget ? ioStyles.highlight : ioStyles.hidden;
              } else {
                // Front: show target as opaque, hide others
                maskStyle = isTarget ? ioStyles.opaque : ioStyles.hidden;
              }
            }

            return (
              <View
                key={mask.id}
                style={[
                  ioStyles.mask,
                  maskStyle,
                  {
                    left,
                    top,
                    width,
                    height,
                  },
                ]}
              />
            );
          })}
      </View>
    </View>
  );
};

/**
 * Renders Anki card HTML content properly with full HTML support:
 * - Lists (ol, ul)
 * - Code blocks (pre, code)
{{ ... }}
 * - Formatting (b, i, u, strong, em)
 * - Line breaks and paragraphs
 * - Images
 * - Audio files
 * - Cloze deletions
 * 
 * Memoized to prevent unnecessary re-renders and image reloading
 */
const CardContentRendererV2 = React.memo(
  function CardContentRendererV2({
    html,
    revealed = false,
    clozeIndex = 0,
    cardId = '',
  }: CardContentRendererProps) {
    const theme = useTheme();
    const { width, height } = useWindowDimensions();

    // Calculate content dimensions accounting for card padding
    // CardPage has: cardContainer padding (16px each side) + absolute positioning (24px each side) = 80px total
    const horizontalPadding = s.lg * 2 + 24 * 2; // cardContainer + absolute view padding
    const contentWidth = width - horizontalPadding;

    const baseFontSize = 20; // Readable size
    const baseLineHeight = 28; // ~1.4 ratio for readability

    // Calculate max image height accounting for card height (75% of screen) and vertical padding
    const cardHeight = height * 0.75; // Card is 75% of screen height
    const verticalPadding = s.xl + s.lg; // Top (24px) + Bottom (16px) padding
    const maxImageHeight = Math.min(cardHeight - verticalPadding - 80, 400); // Leave room for text

    // Memoize audio extraction based on HTML content
    const audioFiles = React.useMemo(() => {
      const extractedAudio: string[] = [];
      const audioRegex = /\[sound:([^\]]+)\]/gi;
      let audioMatch;
      while ((audioMatch = audioRegex.exec(html)) !== null) {
        // Use original filename - files are saved with their original names from .apkg
        const filename = audioMatch[1];
        extractedAudio.push(filename);
      }
      return extractedAudio;
    }, [html]);

    // STEP 1: Fix image sources - ONCE per card (no cloze processing yet)
    const baseHtml = React.useMemo(() => {
      let processed = html;

      // Fix image sources to point to local media directory
      processed = processed.replace(
        /<img([^>]+)src="([^"]+)"([^>]*)>/gi,
        (match, before, src, after) => {
          // Use canonical media URI helper
          const mediaPath = getMediaUri(src);
          return `<img${before}src="${mediaPath}"${after}>`;
        },
      );

      // Remove audio tags
      const audioRegex = /\[sound:([^\]]+)\]/gi;
      processed = processed.replace(audioRegex, '');

      return processed;
    }, [html, cardId]); // ONLY raw HTML

    // Custom renderers for specific HTML elements - consistent Anki-like styling
    const tagsStyles = React.useMemo(
      () => ({
        body: {
          color: theme.colors.textPrimary,
          fontSize: baseFontSize,
          lineHeight: baseLineHeight,
          textAlign: 'center' as const,
          fontWeight: '400' as const,
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
        span: {
          // Allow inline styles (Anki uses spans for colors)
        },
        font: {
          // Allow inline styles (Anki uses font tags for colors)
        },
        code: {
          fontFamily: 'Courier',
          backgroundColor: theme.colors.surface,
          paddingHorizontal: 6,
          paddingVertical: 3,
          borderRadius: 4,
          fontSize: 16,
        },
        a: {
          color: theme.colors.accent,
          textDecorationLine: 'underline' as const,
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
          fontSize: baseFontSize,
          lineHeight: baseLineHeight,
        },
        h1: {
          fontSize: 28,
          fontWeight: '700' as const,
          marginVertical: 12,
        },
        h2: {
          fontSize: 24,
          fontWeight: '700' as const,
          marginVertical: 10,
        },
        h3: {
          fontSize: 20,
          fontWeight: '600' as const,
          marginVertical: 8,
        },
        blockquote: {
          borderLeftWidth: 4,
          borderLeftColor: theme.colors.accent,
          paddingLeft: 12,
          marginVertical: 8,
          fontStyle: 'italic' as const,
          opacity: 0.9,
        },
        hr: {
          borderBottomColor: 'rgba(128,128,128,0.25)',
          borderBottomWidth: 2,
          marginVertical: 16,
        },
        img: {
          marginVertical: 20,
          marginHorizontal: 0,
          alignSelf: 'center' as const,
          maxWidth: contentWidth,
          maxHeight: maxImageHeight,
        },
      }),
      [
        theme.colors.textPrimary,
        theme.colors.accent,
        theme.colors.surface,
        baseFontSize,
        baseLineHeight,
        contentWidth,
        maxImageHeight,
      ],
    );

    // Simple renderersProps with no fade animation and aggressive caching
    const renderersProps = React.useMemo(
      () => ({
        img: {
          enableExperimentalPercentWidth: true,
          defaultImageProps: {
            resizeMode: 'contain',
            fadeDuration: 0,
            // Prevent image reload flicker
            cache: 'force-cache' as any,
            // Keep loaded images in memory
            recyclingKey: cardId,
          },
        },
      }),
      [cardId],
    );

    // STEP 2: Skip image sizing - let images render at natural size
    const sizedHtml = baseHtml;

    // STEP 3: Apply cloze processing based on revealed state
    // Builds BOTH front and back, but only uses one at a time
    const frontHtml = React.useMemo(() => {
      let processed = sizedHtml;

      const clozeRegex = /{{c(\d+)::([\s\S]+?)(?:::([\s\S]+?))?}}/gi;
      processed = processed.replace(clozeRegex, (match, num, text, hint) => {
        const clozeNum = parseInt(num);

        if (clozeNum === clozeIndex + 1) {
          const hasImage = /<img[^>]*>/i.test(text);

          if (hasImage) {
            const hiddenContent = text.replace(
              /<img([^>]*)>/gi,
              (_imgMatch: string, attrs: string) => {
                if (/style\s*=\s*"/i.test(attrs)) {
                  return `<img${attrs.replace(/style\s*=\s*"([^"]*)"/i, 'style="$1; opacity: 0;"')}>`;
                } else {
                  return `<img${attrs} style="opacity: 0;">`;
                }
              },
            );
            return `<span style="background-color: rgba(59, 130, 246, 0.22); color: transparent; border-radius: 4px; padding: 0 2px; display: block; min-height: 20px;">${hiddenContent}</span>`;
          } else {
            // For text only: Split into words and wrap each to avoid highlighting whitespace
            const words = text.split(/(\s+)/); // Keep whitespace in array
            const highlighted = words
              .map((word: string) => {
                // Only wrap non-whitespace
                if (word.trim().length > 0) {
                  return `<span style="background-color: rgba(59, 130, 246, 0.22); color: transparent; border-radius: 4px; padding: 0 2px;">${word}</span>`;
                }
                return word; // Keep whitespace as-is
              })
              .join('');
            return highlighted;
          }
        } else {
          return text;
        }
      });

      return processed;
    }, [sizedHtml, clozeIndex, cardId]);

    const backHtml = React.useMemo(() => {
      let processed = sizedHtml;

      const clozeRegex = /{{c(\d+)::([\s\S]+?)(?:::([\s\S]+?))?}}/gi;
      processed = processed.replace(clozeRegex, (match, num, text, hint) => {
        const clozeNum = parseInt(num);

        if (clozeNum === clozeIndex + 1) {
          // Check if content contains images
          const hasImage = /<img[^>]*>/i.test(text);

          if (hasImage) {
            // For images, don't split - just highlight the whole thing
            return `<span style="background-color: rgba(59, 130, 246, 0.18); color: inherit; border-radius: 4px; padding: 0 2px;">${text}</span>`;
          } else {
            // For text only: Split into words and wrap each to avoid highlighting whitespace
            const words = text.split(/(\s+)/); // Keep whitespace in array
            const highlighted = words
              .map((word: string) => {
                // Only wrap non-whitespace
                if (word.trim().length > 0) {
                  return `<span style="background-color: rgba(59, 130, 246, 0.18); color: inherit; border-radius: 4px; padding: 0 2px;">${word}</span>`;
                }
                return word; // Keep whitespace as-is
              })
              .join('');
            return highlighted;
          }
        } else {
          return text;
        }
      });

      return processed;
    }, [sizedHtml, clozeIndex, cardId]);

    // Use the appropriate HTML based on revealed state
    // CardPage handles the crossfade animation
    const contentHtml = revealed ? backHtml : frontHtml;

    // Memoize source object to prevent RenderHtml from seeing new prop every render
    const htmlSource = React.useMemo(() => ({ html: contentHtml }), [contentHtml]);

    // Memoize defaultTextProps to prevent unnecessary re-renders
    const defaultTextProps = React.useMemo(() => ({ selectable: false }), []);

    // Custom renderers for io-occlude elements
    const customHTMLElementModels = React.useMemo(
      () => ({
        'io-occlude': HTMLElementModel.fromCustomModel({
          tagName: 'io-occlude',
          contentModel: HTMLContentModel.block,
          isVoid: false,
          isOpaque: true,
        }),
      }),
      [],
    );

    const renderers = React.useMemo(
      () => ({
        'io-occlude': ImageOcclusionRenderer,
      }),
      [],
    );

    const renderersPropsWithIO = React.useMemo(
      () => ({
        ...renderersProps,
        'io-occlude': {
          revealed,
          contentWidth,
          maxImageHeight,
        },
      }),
      [renderersProps, revealed, contentWidth, maxImageHeight],
    );

    return (
      <View style={styles.container}>
        <RenderHtml
          contentWidth={contentWidth}
          source={htmlSource}
          tagsStyles={tagsStyles}
          defaultTextProps={defaultTextProps}
          enableCSSInlineProcessing
          renderersProps={renderersPropsWithIO}
          customHTMLElementModels={customHTMLElementModels as any}
          renderers={renderers}
        />

        {/* Audio Players */}
        {audioFiles.map((filename, index) => (
          <AudioPlayer
            key={`${cardId}-${filename}-${index}`}
            filename={filename}
            theme={theme}
            cardId={cardId}
          />
        ))}
      </View>
    );
  },
  (prevProps, nextProps) => {
    // Memo returns TRUE to SKIP re-render
    // CRITICAL: Only compare cardId and revealed to prevent image flicker
    const cardIdSame = prevProps.cardId === nextProps.cardId;
    const revealedSame = prevProps.revealed === nextProps.revealed;
    const shouldSkip = cardIdSame && revealedSame;

    return shouldSkip;
  },
);

export default CardContentRendererV2;

/**
 * Audio player component - Anki style with progress bar
 */
function AudioPlayer({
  filename,
  theme,
  cardId,
}: {
  filename: string;
  theme: any;
  cardId: string;
}) {
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

        // Use canonical media URI helper
        const mediaPath = getMediaUri(filename);

        logger.info('[AudioPlayer] Loading audio:', filename, '→', mediaPath);

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
          },
        );

        setSound(newSound);
        logger.info('[AudioPlayer] Audio loaded successfully:', filename);
      } catch (error) {
        logger.error('[AudioPlayer] Error loading audio:', filename, error);
      }
    };

    initAudio();
  }, [filename]);

  // Cleanup on unmount or when card/filename changes
  React.useEffect(() => {
    return () => {
      if (sound) {
        sound
          .stopAsync()
          .then(() => sound.unloadAsync())
          .catch((e) => logger.error('[AudioPlayer] Cleanup error:', e));
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
      logger.error('[AudioPlayer] Error toggling playback:', error);
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
      logger.error('[AudioPlayer] Error replaying:', error);
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
  const audioTapGesture = Gesture.Tap().onEnd(() => {
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
          <View
            style={[
              styles.playButton,
              { backgroundColor: theme.colors.accent, opacity: sound ? 1 : 0.3 },
            ]}
          >
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
                },
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

        <Pressable onPress={handleReplay} disabled={!sound} style={styles.replayButton}>
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

const ioStyles = StyleSheet.create({
  container: {
    marginVertical: 20,
    alignItems: 'center',
  },
  mask: {
    position: 'absolute',
    borderRadius: 4,
  },
  opaque: {
    backgroundColor: 'rgba(0, 0, 0, 1)',
  },
  highlight: {
    backgroundColor: 'rgba(59, 130, 246, 0.22)',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  hidden: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
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
