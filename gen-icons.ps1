Add-Type -AssemblyName System.Drawing
$root = 'D:\Projects\NimChatApp-starter\NimChatApp'
$src = [System.Drawing.Image]::FromFile("$root\src\assets\chatbot.png")

function Save-Bmp([System.Drawing.Bitmap]$bmp, [string]$out) {
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

function Resize-To([System.Drawing.Image]$img, [int]$size, [string]$out) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($img, 0, 0, $size, $size)
  $g.Dispose()
  Save-Bmp $bmp $out
}

# Adaptive foreground: logo at 62% so it stays inside the 66% safe-zone circle
function Foreground-To([System.Drawing.Image]$img, [int]$size, [string]$out) {
  $inner = [int][Math]::Round($size * 0.62)
  $off = [int][Math]::Round(($size - $inner) / 2)
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($img, $off, $off, $inner, $inner)
  $g.Dispose()
  Save-Bmp $bmp $out
}

function Solid([System.Drawing.Color]$color, [int]$size, [string]$out) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear($color)
  $g.Dispose()
  Save-Bmp $bmp $out
}

$densities = @{ 'mdpi' = 1; 'hdpi' = 1.5; 'xhdpi' = 2; 'xxhdpi' = 3; 'xxxhdpi' = 4 }
foreach ($d in $densities.Keys) {
  $dir = "$root\android\app\src\main\res\mipmap-$d"
  $legacy = [int](48 * $densities[$d])
  $adaptive = [int](108 * $densities[$d])
  Resize-To $src $legacy "$dir\ic_launcher.png"
  Resize-To $src $legacy "$dir\ic_launcher_round.png"
  Foreground-To $src $adaptive "$dir\ic_launcher_foreground.png"
  Solid ([System.Drawing.Color]::White) $adaptive "$dir\ic_launcher_background.png"
}

# iOS single-size 1024, flattened on white (App Store icons reject alpha)
$iosDir = "$root\ios\NimChatApp\Images.xcassets\AppIcon.appiconset"
$ios = New-Object System.Drawing.Bitmap(1024, 1024)
$g = [System.Drawing.Graphics]::FromImage($ios)
$g.Clear([System.Drawing.Color]::White)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.DrawImage($src, 0, 0, 1024, 1024)
$g.Dispose()
Save-Bmp $ios "$iosDir\AppIcon.png"

$src.Dispose()
Write-Host 'ICONS GENERATED'
