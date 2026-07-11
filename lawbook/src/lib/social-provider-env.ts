import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSocialProviderAvailability } from "@/lib/social-providers";

export async function getServerSocialProviderAvailability() {
  const { env } = await getCloudflareContext({ async: true });
  return getSocialProviderAvailability({
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET:
      env.GOOGLE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET,
  });
}
