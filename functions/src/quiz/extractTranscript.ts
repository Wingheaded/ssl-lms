import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { YoutubeTranscript } from "youtube-transcript";

const db = admin.firestore();

/**
 * extractTranscript - specific Cloud Function to extract content from YouTube videos
 * 
 * Accepts: { trainingId: string }
 * Returns: { success: true, transcriptLength: number }
 */
export const extractTranscript = onCall(async (request) => {
    // Auth check - Admin only for now as it's an admin feature
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    // Check if user is admin (optional, but good practice given the button is in Admin UI)
    // For now, allowing any auth user to test, but commonly we'd check custom claims:
    // if (request.auth.token.admin !== true) throw new HttpsError("permission-denied", "Admins only.");

    const { trainingId } = request.data;
    if (!trainingId) {
        throw new HttpsError("invalid-argument", "trainingId is required.");
    }

    try {
        const trainingRef = db.collection("trainings").doc(trainingId);
        const trainingDoc = await trainingRef.get();

        if (!trainingDoc.exists) {
            throw new HttpsError("not-found", "Training not found.");
        }

        const training = trainingDoc.data();

        // Find URL: Check legacy mediaUrl OR search in mediaFiles array
        let mediaUrl = training?.mediaUrl;

        if (!mediaUrl && training?.mediaFiles && Array.isArray(training.mediaFiles)) {
            const youtubeFile = training.mediaFiles.find((f: any) => f.type === 'youtube' || (f.url && f.url.includes('youtube') || f.url.includes('youtu.be')));
            if (youtubeFile) {
                mediaUrl = youtubeFile.url;
            }
        }

        let transcriptText = "";

        // 1. YouTube Extraction
        if (mediaUrl && (mediaUrl.includes("youtube.com") || mediaUrl.includes("youtu.be"))) {
            logger.info(`Attempting to extract YouTube transcript for ${trainingId} from ${mediaUrl}`);

            try {
                // Try Portuguese first
                try {
                    const transcriptItems = await YoutubeTranscript.fetchTranscript(mediaUrl, { lang: "pt" });
                    transcriptText = transcriptItems.map(item => item.text).join(" ");
                } catch (ptError) {
                    logger.warn("Portuguese transcript not found, attempting auto-detect...");
                    // Fallback: try auto-detect
                    const transcriptItems = await YoutubeTranscript.fetchTranscript(mediaUrl);
                    transcriptText = transcriptItems.map(item => item.text).join(" ");
                }

                logger.info(`Successfully extracted ${transcriptText.length} chars from YouTube.`);
            } catch (ytError: any) {
                logger.error("Error fetching YouTube transcript:", ytError);
                throw new HttpsError("unavailable", `Failed to extract transcript: ${ytError.message || "No captions found"}`);
            }
        } else {
            // Future PDF logic here
            throw new HttpsError("failed-precondition", "No valid YouTube URL found in training.");
        }

        // Save to Firestore
        await trainingRef.update({
            transcript: transcriptText,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true, transcriptLength: transcriptText.length };

    } catch (error: any) {
        logger.error("Detailed error in extractTranscript:", error);

        // Re-throw HttpsErrors
        if (error instanceof HttpsError) {
            throw error;
        }

        // Expose the raw error message to the client for debugging
        throw new HttpsError("internal", `System Error: ${error.message || "Unknown error"}`);
    }
});
