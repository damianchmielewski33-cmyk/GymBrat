package pl.gymbrat.app.ads;

import android.app.Activity;

import androidx.annotation.NonNull;

import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

/**
 * Google UMP (User Messaging Platform) — zgoda na reklamy AdMob (EEA/UK).
 */
public final class AdsConsentHelper {
    public interface Callback {
        void onComplete(boolean canRequestAds);
    }

    private AdsConsentHelper() {}

    public static void gather(@NonNull Activity activity, @NonNull Callback callback) {
        ConsentRequestParameters params =
                new ConsentRequestParameters.Builder().build();
        ConsentInformation consentInformation =
                UserMessagingPlatform.getConsentInformation(activity);
        consentInformation.requestConsentInfoUpdate(
                activity,
                params,
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(
                        activity,
                        formError -> callback.onComplete(consentInformation.canRequestAds())
                ),
                formError -> callback.onComplete(consentInformation.canRequestAds())
        );
    }
}
