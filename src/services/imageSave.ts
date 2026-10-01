import { PermissionsAndroid, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

/**
 * Saves a base64 data-URI image into the device gallery ("Trisentric AI" album).
 *
 * camera-roll's Android save only accepts local file URIs, so the data is
 * written to a temp cache file first and handed over as file://, then removed.
 * Android 10+ inserts via MediaStore without any permission; Android 9 and
 * below need WRITE_EXTERNAL_STORAGE granted at runtime.
 */
export async function saveImageToGallery(dataUri: string): Promise<string> {
  const [meta, base64] = dataUri.split(';base64,');
  if (!base64) throw new Error('Unsupported image format');

  const ext = meta.includes('image/png') ? 'png' : meta.includes('image/webp') ? 'webp' : 'jpg';
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/trisentric-${Date.now()}.${ext}`;
  await ReactNativeBlobUtil.fs.writeFile(path, base64, 'base64');

  try {
    return await CameraRoll.save(`file://${path}`, { type: 'photo', album: 'Trisentric AI' });
  } finally {
    ReactNativeBlobUtil.fs.unlink(path).catch(() => {});
  }
}

/** True when saving may proceed (asks on Android 9 and below only). */
export async function ensureGalleryPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Number(Platform.Version) >= 29) return true;
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE!,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}
