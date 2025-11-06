import React, { useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import WebView from 'react-native-webview';
import { useTheme } from '../design/theme';
import { logger } from '../utils/logger';

interface MathJaxRendererProps {
  html: string;
  contentWidth: number;
  baseFontSize?: number;
  cardId?: string;
}

/**
 * Renders HTML with LaTeX/MathJax support using WebView.
 * Only use this for cards that contain LaTeX math notation.
 */
export const MathJaxRenderer: React.FC<MathJaxRendererProps> = ({
  html,
  contentWidth,
  baseFontSize = 20,
  cardId = '',
}) => {
  const theme = useTheme();
  const [webViewHeight, setWebViewHeight] = useState(300);
  const [isLoading, setIsLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  // Build full HTML document with MathJax
  const fullHtml = React.useMemo(() => {
    // Escape backticks in HTML for template literal
    const escapedHtml = html.replace(/`/g, '\\`');
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script>
    // Fail-safe timeout - if MathJax doesn't load in 5s, show content anyway
    let failsafeTimer = setTimeout(() => {
      const height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height }));
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'loaded' }));
    }, 5000);
    
    window.MathJax = {
      tex: {
        inlineMath: [['\\\\(', '\\\\)'], ['$', '$']],
        displayMath: [['\\\\[', '\\\\]'], ['$$', '$$']],
        processEscapes: true,
        processEnvironments: true,
        packages: { '[+]': ['noerrors', 'noundefined', 'require', 'ams'] }
      },
      svg: {
        fontCache: 'global',
        scale: 1,
        linebreaks: { automatic: true, width: '${contentWidth - 16}px' }
      },
      options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
      },
      startup: {
        ready: () => {
          MathJax.startup.defaultReady();
          MathJax.startup.promise.then(() => {
            clearTimeout(failsafeTimer);
            
            // Send initial height after MathJax renders
            const sendHeight = () => {
              const height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height }));
            };
            
            setTimeout(sendHeight, 100);
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'loaded' }));
            
            // Watch for content reflows (images, fonts, retypeset)
            if (typeof ResizeObserver !== 'undefined') {
              let debounceTimer;
              const observer = new ResizeObserver(() => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(sendHeight, 150);
              });
              observer.observe(document.body);
            }
          }).catch((err) => {
            clearTimeout(failsafeTimer);
            // Even if MathJax fails, show content
            const height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', height }));
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'loaded' }));
          });
        }
      }
    };
  </script>
  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" async onerror="clearTimeout(failsafeTimer); window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'loaded' }));"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: ${baseFontSize}px;
      line-height: 1.4;
      color: ${theme.colors.textPrimary};
      background-color: transparent;
      text-align: center;
      padding: 20px 0;
      overflow-x: hidden;
      word-wrap: break-word;
    }
    p {
      margin: 8px 0;
    }
    strong, b {
      font-weight: 700;
    }
    em, i {
      font-style: italic;
    }
    u {
      text-decoration: underline;
    }
    code {
      font-family: 'Courier New', monospace;
      background-color: ${theme.colors.surface};
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 16px;
    }
    pre {
      background-color: ${theme.colors.surface};
      padding: 12px;
      border-radius: 8px;
      margin: 8px 0;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.4;
      overflow-x: auto;
      text-align: left;
    }
    pre code {
      background-color: transparent;
      padding: 0;
    }
    ol, ul {
      margin: 8px 0;
      padding-left: 20px;
      text-align: left;
    }
    li {
      margin: 4px 0;
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      margin: 12px 0;
    }
    h2 {
      font-size: 24px;
      font-weight: 700;
      margin: 10px 0;
    }
    h3 {
      font-size: 20px;
      font-weight: 600;
      margin: 8px 0;
    }
    blockquote {
      border-left: 4px solid ${theme.colors.accent};
      padding-left: 12px;
      margin: 8px 0;
      font-style: italic;
      opacity: 0.9;
    }
    hr {
      border: none;
      border-bottom: 2px solid rgba(128, 128, 128, 0.25);
      margin: 16px 0;
    }
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 20px auto;
    }
    a {
      color: ${theme.colors.accent};
      text-decoration: underline;
    }
    /* MathJax styling */
    mjx-container {
      margin: 8px 0;
      display: inline-block;
    }
    mjx-container[display="true"] {
      display: block;
      margin: 12px 0;
    }
    /* Cloze deletion styling */
    .cloze {
      background-color: rgba(59, 130, 246, 0.22);
      color: transparent;
      border-radius: 4px;
      padding: 0 2px;
    }
    .cloze-revealed {
      background-color: rgba(59, 130, 246, 0.18);
      color: inherit;
      border-radius: 4px;
      padding: 0 2px;
    }
  </style>
</head>
<body>
  ${escapedHtml}
</body>
</html>
    `.trim();
  }, [html, theme.colors, baseFontSize, cardId]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'height') {
        // Add some padding to prevent cutoff
        setWebViewHeight(data.height + 40);
      } else if (data.type === 'loaded') {
        setIsLoading(false);
      }
    } catch (error) {
      logger.error('[MathJaxRenderer] Error parsing message:', error);
    }
  };

  const handleError = (error: any) => {
    logger.error('[MathJaxRenderer] WebView error:', error);
    setIsLoading(false);
  };

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ html: fullHtml }}
        style={[
          styles.webView,
          { 
            height: webViewHeight,
            opacity: isLoading ? 0 : 1,
          }
        ]}
        onMessage={handleMessage}
        onError={handleError}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        // Performance optimizations
        // Use software layer for better compatibility with heavy SVG math rendering
        androidLayerType="software"
        cacheEnabled={true}
        // Prevent zoom and scroll
        injectedJavaScript={`
          const meta = document.createElement('meta');
          meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
          meta.setAttribute('name', 'viewport');
          document.getElementsByTagName('head')[0].appendChild(meta);
          true;
        `}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    minHeight: 100,
  },
  webView: {
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});
