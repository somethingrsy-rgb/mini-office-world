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
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, uint f);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int cb; public RECT m; public RECT w; public uint f; }
  [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO i);
  // 지금 맨 앞 창이 모니터 전체를 덮고 제목 표시줄이 없으면(영상·발표·게임 전체 화면) 1
  static int Full(uint skipPid) {
    IntPtr h = GetForegroundWindow(); if (h == IntPtr.Zero) return 0;
    uint pid; GetWindowThreadProcessId(h, out pid); if (pid == skipPid) return 0;
    var cls = new StringBuilder(64); GetClassName(h, cls, 64); string c = cls.ToString();
    if (c == "Progman" || c == "WorkerW" || c == "Shell_TrayWnd") return 0;
    RECT r; if (!GetWindowRect(h, out r)) return 0;
    var mi = new MONITORINFO(); mi.cb = Marshal.SizeOf(typeof(MONITORINFO));
    if (!GetMonitorInfo(MonitorFromWindow(h, 2), ref mi)) return 0;
    bool cover = r.L <= mi.m.L && r.T <= mi.m.T && r.R >= mi.m.R && r.B >= mi.m.B;
    bool caption = (GetWindowLong(h, -16) & 0x00C00000) == 0x00C00000;
    return cover && !caption ? 1 : 0;
  }
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
    return "F" + Full(skipPid) + "|" + sb.ToString();
  }
}
"@
[WinList]::Init()
while ($true) { [Console]::Out.WriteLine([WinList]::Run(__PID__)); [Console]::Out.Flush(); Start-Sleep -Milliseconds 400 }
