import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

function isUsernameSignIn(request: Request): boolean {
  const pathname = new URL(request.url).pathname;
  return request.method === "POST" && pathname.endsWith("/sign-in/username");
}

function invalidCredentialsResponse() {
  return Response.json(
    { code: "INVALID_CREDENTIALS", message: "Invalid username or password" },
    { status: 401 },
  );
}

async function handleAuthRequest(request: Request) {
  try {
    const auth = await getAuth();
    const response = await auth.handler(request);

    if (isUsernameSignIn(request) && response.status >= 500) {
      console.error("Username sign-in returned a server error", {
        status: response.status,
        statusText: response.statusText,
      });
      return invalidCredentialsResponse();
    }

    return response;
  } catch (error) {
    console.error("Auth route failed", {
      method: request.method,
      url: request.url,
      error,
    });

    if (isUsernameSignIn(request)) {
      return invalidCredentialsResponse();
    }

    return Response.json(
      { code: "AUTH_SERVER_ERROR", message: "Authentication service failed" },
      { status: 500 },
    );
  }
}

export const GET = handleAuthRequest;
export const POST = handleAuthRequest;
