using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Reflection;
using System.Text;
using System.Threading;

// Trycord client launcher (.trycord)
// Serves the embedded web client (index.html / app.js / style.css) on
// http://localhost:<port>/ and opens it in the default browser.
// The chat API is expected at http://localhost:3000 (trycord-server).
// C# 5 compatible so it builds with the inbox .NET Framework csc.
public static class TrycordLauncher
{
    private const string ApiBase = "http://localhost:3000";
    private const int StartPort = 8080;
    private const int MaxPort = 8099;

    public static void Main()
    {
        Console.Title = ".trycord client";
        Console.WriteLine(".trycord client launcher");
        Console.WriteLine("========================");

        HttpListener listener = null;
        int port = -1;
        for (int p = StartPort; p <= MaxPort; p++)
        {
            HttpListener candidate = new HttpListener();
            candidate.Prefixes.Add("http://localhost:" + p + "/");
            try
            {
                candidate.Start();
                listener = candidate;
                port = p;
                break;
            }
            catch (HttpListenerException)
            {
                candidate.Close();
            }
        }

        if (listener == null)
        {
            Console.WriteLine("ERROR: no free port in range 8080-8099.");
            Pause();
            return;
        }

        string url = "http://localhost:" + port + "/";
        Console.WriteLine("Serving client at " + url);

        Thread serveThread = new Thread(new ParameterizedThreadStart(ServeLoop));
        serveThread.IsBackground = true;
        serveThread.Start(listener);

        CheckApi();

        try
        {
            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = url;
            psi.UseShellExecute = true;
            Process.Start(psi);
            Console.WriteLine("Opened default browser.");
        }
        catch (Exception ex)
        {
            Console.WriteLine("Could not open browser automatically: " + ex.Message);
            Console.WriteLine("Open this URL manually: " + url);
        }

        Console.WriteLine("");
        Console.WriteLine("Press Q to quit.");
        while (true)
        {
            ConsoleKeyInfo key = Console.ReadKey(true);
            if (key.Key == ConsoleKey.Q) break;
        }
        try { listener.Stop(); } catch { }
    }

    private static void CheckApi()
    {
        try
        {
            HttpWebRequest req = (HttpWebRequest)WebRequest.Create(ApiBase + "/health");
            req.Timeout = 2000;
            using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
            {
                if (res.StatusCode == HttpStatusCode.OK)
                {
                    Console.WriteLine("API online at " + ApiBase + " (trycord-server running).");
                    return;
                }
            }
        }
        catch { }
        Console.WriteLine("WARNING: no server at " + ApiBase + ".");
        Console.WriteLine("Start it first:  cd trycord-server  &&  npm start");
    }

    private static void ServeLoop(object state)
    {
        HttpListener listener = (HttpListener)state;
        while (listener.IsListening)
        {
            HttpListenerContext ctx = null;
            try { ctx = listener.GetContext(); }
            catch { break; }
            try { Handle(ctx); }
            catch
            {
                try { ctx.Response.StatusCode = 500; ctx.Response.Close(); } catch { }
            }
        }
    }

    private static void Handle(HttpListenerContext ctx)
    {
        string path = ctx.Request.Url.AbsolutePath;
        string resource;
        string mime;
        if (path == "/" || path.Equals("/index.html", StringComparison.OrdinalIgnoreCase))
        {
            resource = "TrycordClient.index.html";
            mime = "text/html; charset=utf-8";
        }
        else if (path.Equals("/app.js", StringComparison.OrdinalIgnoreCase))
        {
            resource = "TrycordClient.app.js";
            mime = "application/javascript; charset=utf-8";
        }
        else if (path.Equals("/style.css", StringComparison.OrdinalIgnoreCase))
        {
            resource = "TrycordClient.style.css";
            mime = "text/css; charset=utf-8";
        }
        else
        {
            ctx.Response.StatusCode = 404;
            Write(ctx, "Not found", "text/plain; charset=utf-8");
            return;
        }

        byte[] body = ReadResource(resource);
        if (body == null)
        {
            ctx.Response.StatusCode = 500;
            Write(ctx, "Embedded resource missing: " + resource, "text/plain; charset=utf-8");
            return;
        }
        ctx.Response.ContentType = mime;
        ctx.Response.ContentLength64 = body.Length;
        ctx.Response.OutputStream.Write(body, 0, body.Length);
        ctx.Response.Close();
    }

    private static void Write(HttpListenerContext ctx, string text, string mime)
    {
        byte[] body = Encoding.UTF8.GetBytes(text);
        ctx.Response.ContentType = mime;
        ctx.Response.ContentLength64 = body.Length;
        ctx.Response.OutputStream.Write(body, 0, body.Length);
        ctx.Response.Close();
    }

    private static byte[] ReadResource(string name)
    {
        Assembly asm = Assembly.GetExecutingAssembly();
        using (Stream s = asm.GetManifestResourceStream(name))
        {
            if (s == null) return null;
            using (MemoryStream ms = new MemoryStream())
            {
                s.CopyTo(ms);
                return ms.ToArray();
            }
        }
    }

    private static void Pause()
    {
        Console.WriteLine("Press any key to exit.");
        Console.ReadKey(true);
    }
}
