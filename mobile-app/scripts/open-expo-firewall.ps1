# Opens inbound TCP ports for Expo Metro + common RN ports + backend (5000).
# Run PowerShell as Administrator, then:
#   Set-Location ...\mobile-app
#   .\scripts\open-expo-firewall.ps1

$ErrorActionPreference = "Stop"
$ports = @(5000, 8081, 8082, 8083, 8084, 19000, 19001)
foreach ($p in $ports) {
  $name = "KMF Grocery Dev TCP $p"
  netsh advfirewall firewall delete rule name="$name" 2>$null
  netsh advfirewall firewall add rule name="$name" dir=in action=allow protocol=TCP localport=$p
  Write-Host "Added rule: $name"
}
Write-Host "Done. Restart Expo and try Expo Go again."
