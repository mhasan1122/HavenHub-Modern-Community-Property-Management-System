#!/bin/bash

# Fix AndroidManifest.xml for Firebase notification color conflict

MANIFEST="android/app/src/main/AndroidManifest.xml"

echo "🔧 Fixing AndroidManifest.xml..."

if [ ! -f "$MANIFEST" ]; then
  echo "❌ AndroidManifest.xml not found at: $MANIFEST"
  echo "💡 Run 'npx expo prebuild' first to generate Android files."
  exit 1
fi

# Backup original
cp "$MANIFEST" "${MANIFEST}.backup"
echo "✅ Created backup: ${MANIFEST}.backup"

# Check if tools namespace exists
if ! grep -q 'xmlns:tools' "$MANIFEST"; then
  echo "📝 Adding xmlns:tools namespace..."
  # Add tools namespace to manifest tag
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' 's/<manifest xmlns:android/<manifest xmlns:android xmlns:tools/g' "$MANIFEST"
  else
    # Linux
    sed -i 's/<manifest xmlns:android/<manifest xmlns:android xmlns:tools/g' "$MANIFEST"
  fi
  echo "✅ Added xmlns:tools namespace"
else
  echo "✅ xmlns:tools namespace already exists"
fi

# Fix notification color meta-data
if grep -q 'com.google.firebase.messaging.default_notification_color' "$MANIFEST"; then
  echo "📝 Fixing notification color meta-data..."
  
  # Check if tools:replace already exists
  if ! grep -q 'tools:replace' "$MANIFEST"; then
    # Add tools:replace attribute
    if [[ "$OSTYPE" == "darwin"* ]]; then
      # macOS
      sed -i '' 's/android:resource="@color\/notification_icon_color" \/>/android:resource="@color\/notification_icon_color" tools:replace="android:resource" \/>/g' "$MANIFEST"
      sed -i '' 's/android:resource="@color\/notification_icon_color"\/>/android:resource="@color\/notification_icon_color" tools:replace="android:resource"\/>/g' "$MANIFEST"
    else
      # Linux
      sed -i 's/android:resource="@color\/notification_icon_color" \/>/android:resource="@color\/notification_icon_color" tools:replace="android:resource" \/>/g' "$MANIFEST"
      sed -i 's/android:resource="@color\/notification_icon_color"\/>/android:resource="@color\/notification_icon_color" tools:replace="android:resource"\/>/g' "$MANIFEST"
    fi
    echo "✅ Added tools:replace attribute"
  else
    echo "✅ tools:replace already exists"
  fi
else
  echo "⚠️  Notification color meta-data not found (may need to add manually)"
fi

# Create colors.xml if it doesn't exist
COLORS_FILE="android/app/src/main/res/values/colors.xml"
if [ ! -f "$COLORS_FILE" ]; then
  echo "📝 Creating colors.xml..."
  mkdir -p "$(dirname "$COLORS_FILE")"
  cat > "$COLORS_FILE" << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="notification_icon_color">#3D9D9B</color>
</resources>
EOF
  echo "✅ Created colors.xml with notification color"
else
  echo "✅ colors.xml already exists"
fi

echo ""
echo "✅ AndroidManifest.xml fixed!"
echo "💡 You can now rebuild: npx expo run:android"
