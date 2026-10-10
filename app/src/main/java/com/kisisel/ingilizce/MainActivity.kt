package com.kisisel.ingilizce

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import java.io.ByteArrayInputStream
import java.util.Locale

class MainActivity : Activity() {

    private lateinit var web: WebView
    private var tts: TextToSpeech? = null

    @Volatile
    private var ttsOk = false

    /** JavaScript tarafından çağrılan köprü: cihazın kendi metin okuma motorunu kullanır. */
    inner class Bridge {
        @JavascriptInterface
        fun ttsReady(): Boolean = ttsOk

        @JavascriptInterface
        fun speak(text: String, slow: Boolean) {
            try {
                val engine = tts ?: return
                if (!ttsOk) return
                engine.setSpeechRate(if (slow) 0.6f else 0.95f)
                engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "ek-utterance")
            } catch (_: Exception) {
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        try {
            tts = TextToSpeech(applicationContext) { status ->
                if (status == TextToSpeech.SUCCESS) {
                    val r = tts?.setLanguage(Locale.US)
                    ttsOk = r != null &&
                        r != TextToSpeech.LANG_MISSING_DATA &&
                        r != TextToSpeech.LANG_NOT_SUPPORTED
                }
            }
        } catch (_: Exception) {
            ttsOk = false
        }

        web = WebView(this)
        setContentView(web)

        val s = web.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.allowFileAccess = false
        s.allowContentAccess = false
        s.setSupportZoom(false)
        s.textZoom = 100
        s.cacheMode = WebSettings.LOAD_DEFAULT

        web.addJavascriptInterface(Bridge(), "Android")

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                val uri = request.url
                if (uri.host != HOST) return null
                var path = uri.path ?: "/"
                if (path == "/" || path.isEmpty()) path = "/index.html"
                return try {
                    val stream = assets.open("www$path")
                    WebResourceResponse(mimeFor(path), "utf-8", stream)
                } catch (e: Exception) {
                    WebResourceResponse(
                        "text/plain", "utf-8", 404, "Not Found",
                        emptyMap(), ByteArrayInputStream(ByteArray(0))
                    )
                }
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val uri: Uri = request.url
                if (uri.host == HOST) return false
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                } catch (_: Exception) {
                }
                return true
            }
        }

        if (savedInstanceState == null) {
            web.loadUrl("https://$HOST/index.html")
        } else {
            web.restoreState(savedInstanceState)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        try {
            tts?.stop()
            tts?.shutdown()
        } catch (_: Exception) {
        }
        super.onDestroy()
    }

    private fun mimeFor(path: String): String = when {
        path.endsWith(".html") -> "text/html"
        path.endsWith(".js") -> "application/javascript"
        path.endsWith(".css") -> "text/css"
        path.endsWith(".json") -> "application/json"
        path.endsWith(".svg") -> "image/svg+xml"
        path.endsWith(".png") -> "image/png"
        else -> "application/octet-stream"
    }

    companion object {
        private const val HOST = "appassets.local"
    }
}
