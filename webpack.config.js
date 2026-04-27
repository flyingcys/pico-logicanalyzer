const path = require('path');
const webpack = require('webpack');
const { VueLoaderPlugin } = require('vue-loader');
const HtmlWebpackPlugin = require('html-webpack-plugin');

class WebviewAssetManifestPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('WebviewAssetManifestPlugin', compilation => {
      compilation.hooks.processAssets.tap(
        {
          name: 'WebviewAssetManifestPlugin',
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE
        },
        () => {
          const manifest = {};
          const vscodeEntrypoint = compilation.entrypoints.get('main-vscode');
          const htmlEntrypoint = compilation.entrypoints.get('main-html');
          const getEntryScript = (entrypoint, entryName) => {
            if (!entrypoint) {
              return undefined;
            }

            const hashedEntryPattern = new RegExp(`^${entryName}(\\.[a-f0-9]{8})?\\.js$`);
            return entrypoint.getFiles().find(file => hashedEntryPattern.test(file));
          };

          const vscodeScript = getEntryScript(vscodeEntrypoint, 'main-vscode');
          if (vscodeScript) {
            manifest['main-vscode.js'] = vscodeScript;
          } else {
            compilation.errors.push(new Error('Webview manifest 缺少 main-vscode.js 产物'));
          }

          const htmlScript = getEntryScript(htmlEntrypoint, 'main-html');
          if (htmlScript) {
            manifest['main-html.js'] = htmlScript;
          } else {
            compilation.errors.push(new Error('Webview manifest 缺少 main-html.js 产物'));
          }

          if (compilation.getAsset('html/index.html')) {
            manifest['html/index.html'] = 'html/index.html';
          } else {
            compilation.errors.push(new Error('Webview manifest 缺少 html/index.html 产物'));
          }

          compilation.emitAsset(
            'webview-manifest.json',
            new webpack.sources.RawSource(`${JSON.stringify(manifest, null, 2)}\n`)
          );
        }
      );
    });
  }
}

/**
 * 生产级Webpack配置
 * 支持环境区分、优化和代码分割
 */

// 环境变量
const isDevelopment = process.env.NODE_ENV !== 'production';
const isProduction = !isDevelopment;

// 基础配置
const baseConfig = {
  stats: {
    errorDetails: true,
    children: true
  },
  infrastructureLogging: {
    level: isDevelopment ? 'info' : 'warn'
  }
};

// Extension配置 - Node.js环境
const extensionConfig = {
  ...baseConfig,
  name: 'extension',
  target: 'node',
  mode: isDevelopment ? 'development' : 'production',
  entry: {
    extension: './src/extension.ts'
  },
  output: {
    path: path.resolve(__dirname, 'out'),
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    clean: true
  },
  externals: {
    vscode: 'commonjs vscode',
    // Node.js原生模块外部化
    serialport: 'commonjs serialport',
    fs: 'commonjs fs',
    path: 'commonjs path',
    os: 'commonjs os',
    crypto: 'commonjs crypto',
    events: 'commonjs events'
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@drivers': path.resolve(__dirname, 'src/drivers'),
      '@models': path.resolve(__dirname, 'src/models'),
      '@utils': path.resolve(__dirname, 'src/utils')
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true, // 忽略类型检查，仅转译
              compilerOptions: {
                sourceMap: true,
                declaration: false // 生产环境不生成.d.ts
              }
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.EXTENSION_MODE': JSON.stringify('node')
    }),
    // 模块联邦或动态导入优化
    new webpack.optimize.ModuleConcatenationPlugin()
  ],
  optimization: {
    minimize: isProduction,
    sideEffects: false,
    usedExports: true,
    // 代码分割（对于extension不太适用，但保留配置）
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10
        }
      }
    }
  },
  devtool: isDevelopment ? 'eval-source-map' : 'source-map'
};

// Webview配置 - Web环境
const webviewConfig = {
  ...baseConfig,
  name: 'webview',
  target: ['web', 'es2020'],
  mode: isDevelopment ? 'development' : 'production',
  entry: {
    'main-vscode': './src/frontend/app/main-vscode.ts',
    'main-html': './src/frontend/app/main-html.ts'
  },
  output: {
    path: path.resolve(__dirname, 'out/webview'),
    filename: isDevelopment ? '[name].js' : '[name].[contenthash:8].js',
    chunkFilename: isDevelopment ? '[name].chunk.js' : '[name].[contenthash:8].chunk.js',
    clean: true,
    publicPath: ''
  },
  resolve: {
    extensions: ['.ts', '.js', '.vue'],
    alias: {
      '@': path.resolve(__dirname, 'src/frontend'),
      '@components': path.resolve(__dirname, 'src/frontend/app/components'),
      '@stores': path.resolve(__dirname, 'src/frontend/core/stores'),
      '@utils': path.resolve(__dirname, 'src/frontend/core'),
      '@drivers': path.resolve(__dirname, 'src/drivers'),
      '@models': path.resolve(__dirname, 'src/models')
    }
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: {
          compilerOptions: {
            isCustomElement: tag => tag.startsWith('vscode-')
          }
        }
      },
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              appendTsSuffixTo: [/\.vue$/],
              transpileOnly: true, // 忽略类型检查，仅转译
              compilerOptions: {
                sourceMap: true,
                declaration: false
              }
            }
          }
        ]
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              sourceMap: isDevelopment,
              modules: {
                auto: true,
                localIdentName: isDevelopment 
                  ? '[name]__[local]___[hash:base64:5]'
                  : '[hash:base64:8]'
              }
            }
          }
        ]
      },
      {
        test: /\.scss$/,
        use: [
          'style-loader',
          'css-loader',
          'sass-loader'
        ]
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/images/[name].[hash:8][ext]'
        }
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/fonts/[name].[hash:8][ext]'
        }
      }
    ]
  },
  plugins: [
    new VueLoaderPlugin(),
    new WebviewAssetManifestPlugin(),
    new HtmlWebpackPlugin({
      template: 'src/frontend/app/index.html',
      filename: 'html/index.html',
      chunks: ['main-html'],
      publicPath: '../',
      inject: true,
      minify: isProduction ? {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true
      } : false
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.VUE_APP_VERSION': JSON.stringify(require('./package.json').version),
      'process.env.EXTENSION_MODE': JSON.stringify('webview'),
      '__VUE_OPTIONS_API__': JSON.stringify(true),
      '__VUE_PROD_DEVTOOLS__': JSON.stringify(isDevelopment)
    }),
    // 热重载支持
    ...(isDevelopment ? [new webpack.HotModuleReplacementPlugin()] : [])
  ],
  optimization: {
    minimize: isProduction,
    sideEffects: false,
    usedExports: true
  },
  // 性能预算 - 为VSCode扩展调整
  performance: {
    maxAssetSize: 1500000,       // 1.5MB - 考虑到element-plus的大小
    maxEntrypointSize: 2500000,  // 2.5MB - 为整个entrypoint提供更大空间
    hints: isProduction ? 'warning' : false,
    // 排除已知的大文件
    assetFilter: function(assetFilename) {
      // 不对这些已知会很大的文件进行警告
      return !/(element-plus|vendors|vue-vendor)\.[a-z0-9]+\.js$/.test(assetFilename);
    }
  },
  devtool: isDevelopment ? 'eval-cheap-module-source-map' : 'source-map'
};

// 开发服务器配置（如果需要）
if (isDevelopment) {
  webviewConfig.devServer = {
    hot: true,
    open: false,
    port: 3000,
    historyApiFallback: true,
    client: {
      overlay: {
        errors: true,
        warnings: false
      }
    }
  };
}

module.exports = [extensionConfig, webviewConfig];
