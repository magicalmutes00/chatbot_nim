import { PermissionsAndroid, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

/**
 * Saves a data-URI or remote (S3 presigned URL) image into the device gallery
 * ("Trisentric AI" album).
 *
 * camera-roll's Android save only accepts local file URIs, so data URIs are
 * written to a temp cache file and remote images are downloaded into the cache
 * first; both are handed over as file:// and removed afterwards. Android 10+
 * inserts via MediaStore without any permission; Android 9 and below need
 * WRITE_EXTERNAL_STORAGE granted at runtime.
 */
export async function saveImageToGallery(source: string): Promise<string> {
  let path: string;
  let cleanup: (() => void) | null = null;

  if (source.startsWith('data:')) {
    const [meta, base64] = source.split(';base64,');
    if (!base64) throw new Error('Unsupported image format');

    const ext = meta.includes('image/png') ? 'png' : meta.includes('image/webp') ? 'webp' : 'jpg';
    path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/trisentric-${Date.now()}.${ext}`;
    await ReactNativeBlobUtil.fs.writeFile(path, base64, 'base64');
    cleanup = () => {
      ReactNativeBlobUtil.fs.unlink(path).catch(() => {});
    };
  } else {
    // Generated images live in S3 behind a short-lived presigned GET, so
    // download into the cache. The object key keeps its extension, which lets
    // camera-roll/MediaStore pick the right MIME type.
    const pathname = source.split('?')[0];
    const ext = /\.png$/i.test(pathname) ? 'png' : /\.webp$/i.test(pathname) ? 'webp' : 'jpg';
    const res = await ReactNativeBlobUtil.config({
      fileCache: true,
      appendExt: ext,
    }).fetch('GET', source);
    path = res.path();
    cleanup = () => {
      ReactNativeBlobUtil.fs.unlink(path).catch(() => {});
    };
  }

  try {
    return await CameraRoll.save(`file://${path}`, { type: 'photo', album: 'Trisentric AI' });
  } finally {
    cleanup?.();
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
