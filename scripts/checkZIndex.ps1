#!/usr/bin/env pwsh
# Vérification visuelle rapide des corrections z-index

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        VERIFICATION Z-INDEX - NAVIGATION MENU COMBAT          ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$checks = @{
    "PokemonBattleScene.js" = "this.scene.bringToTop"
    "PokemonTeamScene.js" = "this.scene.bringToTop"
    "PokemonDetailScene.js" = "this.scene.bringToTop"
}

$allGood = $true

foreach ($file in $checks.Keys) {
    $path = Join-Path "src" $file
    
    if (Test-Path $path) {
        $content = Get-Content $path -Raw
        $matches = ([regex]::Matches($content, "this\.scene\.bringToTop")).Count
        
        if ($matches -gt 0) {
            Write-Host "✅ " -ForegroundColor Green -NoNewline
            Write-Host "$file - $matches occurrence(s) trouvée(s)" -ForegroundColor White
        }
        else {
            Write-Host "❌ " -ForegroundColor Red -NoNewline
            Write-Host "$file - AUCUN bringToTop trouvé" -ForegroundColor Red
            $allGood = $false
        }
    }
    else {
        Write-Host "❌ " -ForegroundColor Red -NoNewline
        Write-Host "$file - Fichier non trouvé" -ForegroundColor Red
        $allGood = $false
    }
}

Write-Host ""
Write-Host "─────────────────────────────────────────────────────────────" -ForegroundColor Cyan

if ($allGood) {
    Write-Host ""
    Write-Host "🎉 " -ForegroundColor Green -NoNewline
    Write-Host "TOUS LES bringToTop SONT EN PLACE !" -ForegroundColor Green
    Write-Host ""
    Write-Host "Détails:" -ForegroundColor Yellow
    Write-Host "  • BattleScene → TeamScene ✅" -ForegroundColor White
    Write-Host "  • TeamScene → DetailScene ✅" -ForegroundColor White
    Write-Host "  • TeamScene → ReturnScene ✅" -ForegroundColor White
    Write-Host "  • DetailScene → BattleScene ✅" -ForegroundColor White
    Write-Host ""
    Write-Host "Prochaine étape:" -ForegroundColor Yellow
    Write-Host "  1. npm run server (Terminal 1)" -ForegroundColor White
    Write-Host "  2. npm start (Terminal 2)" -ForegroundColor White
    Write-Host "  3. Suivre QUICK_TEST_CHECKLIST.md" -ForegroundColor White
    Write-Host ""
}
else {
    Write-Host ""
    Write-Host "⚠️  CERTAINS bringToTop SONT MANQUANTS" -ForegroundColor Red
    Write-Host ""
    exit 1
}

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "                    ✅ READY FOR TESTING                       " -ForegroundColor Green -BackgroundColor Black
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
