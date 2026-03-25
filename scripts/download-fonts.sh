#!/bin/bash
set -e
mkdir -p public/fonts

echo "Downloading Playfair Display..."
curl -sL -o public/fonts/playfair-regular.woff2 \
  "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtM.woff2"

curl -sL -o public/fonts/playfair-600.woff2 \
  "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKeiunDXbtM.woff2"

curl -sL -o public/fonts/playfair-700.woff2 \
  "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKe7unDXbtM.woff2"

echo "Downloading Nunito Sans..."
curl -sL -o public/fonts/nunito-regular.woff2 \
  "https://fonts.gstatic.com/s/nunitosans/v15/pe0TMImSLYBIv1o4X1M8ce2xCx3yop4tQpF_MeTm0lfGWVpNn64CL7U.woff2"

curl -sL -o public/fonts/nunito-600.woff2 \
  "https://fonts.gstatic.com/s/nunitosans/v15/pe0TMImSLYBIv1o4X1M8ce2xCx3yop4tQpF_MeTm0lfUXlpNn64CL7U.woff2"

curl -sL -o public/fonts/nunito-700.woff2 \
  "https://fonts.gstatic.com/s/nunitosans/v15/pe0TMImSLYBIv1o4X1M8ce2xCx3yop4tQpF_MeTm0lfWXlpNn64CL7U.woff2"

echo "Done. Font files:"
ls -la public/fonts/
