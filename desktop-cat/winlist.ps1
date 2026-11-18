# 열려 있는 창들의 위치를 0.4초마다 한 줄로 알려줘요 (고양이가 창 위에 올라앉을 때 써요). 창 내용은 읽지 않고 위치만 봐요.
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices; using System.Text;
public static class WinList {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll", EntryPoint="GetWindowLongW")] static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int s);
  public static void Init() { SetProcessDPIAware(); }
  public static string Run(uint skipPid) {
    var sb = new StringBuilder();
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h) || IsIconic(h)) return true;
      if (GetWindowTextLength(h) == 0) return true;
      int ex = GetWindowLong(h, -20);
      if ((ex & 0x80) != 0 || (ex & 0x08000000) != 0) return true;
      int cloaked; if (DwmGetWindowAttribute(h, 14, out cloaked, 4) == 0 && cloaked != 0) return true;
      uint pid; GetWindowThreadProcessId(h, out pid); if (pid == skipPid) return true;
      RECT r; if (!GetWindowRect(h, out r)) return true;
      sb.Append(h.ToInt64()).Append(':').Append(r.L).Append(':').Append(r.T).Append(':').Append(r.R).Append(':').Append(r.B).Append(';');
      return true;
    }, IntPtr.Zero);
    return sb.ToString();
  }
}
"@
[WinList]::Init()
while ($true) { [Console]::Out.WriteLine([WinList]::Run(__PID__)); [Console]::Out.Flush(); Start-Sleep -Milliseconds 400 }
