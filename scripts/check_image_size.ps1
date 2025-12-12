Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile("public/assets/apparences/Marin.png")
Write-Host "Width: $($image.Width)"
Write-Host "Height: $($image.Height)"
$image.Dispose()
