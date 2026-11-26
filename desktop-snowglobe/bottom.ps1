# 오르골 창을 열려 있는 다른 창들의 맨 뒤(바탕화면 바로 위)로 계속 보내요. 창 내용은 읽지 않아요.
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public static class ZBottom {
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
}
"@
$h = [IntPtr]__HWND__
while ($true) { [ZBottom]::SetWindowPos($h, [IntPtr]1, 0, 0, 0, 0, 0x0013) | Out-Null; Start-Sleep -Milliseconds 400 }   # 1 = HWND_BOTTOM, 0x13 = 크기·위치 그대로 + 활성화 안 함
