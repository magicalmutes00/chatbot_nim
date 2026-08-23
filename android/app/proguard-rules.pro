# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# --- Production additions -------------------------------------------------
# react-native-config reads .env values by reflecting over the app's
# BuildConfig fields. Without this keep rule, R8 strips/renames them and
# Config.NVIDIA_API_KEY becomes undefined at runtime.
-keep class com.nimchatapp.BuildConfig { *; }

# Keep line numbers for readable crash stack traces.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
