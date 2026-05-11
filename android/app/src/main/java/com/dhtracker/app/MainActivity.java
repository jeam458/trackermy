package com.dhtracker.app;

import android.content.Intent;
import com.getcapacitor.BridgeActivity;

/**
 * singleTask + OAuth: el retorno desde el navegador llama onNewIntent;
 * hay que actualizar el intent para que Capacitor/App dispare appUrlOpen con la URL.
 */
public class MainActivity extends BridgeActivity {

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
  }
}
