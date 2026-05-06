const LINKEDIN_AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const LINKEDIN_UGC_POST_URL = 'https://api.linkedin.com/v2/ugcPosts'
const LINKEDIN_ME_URL = 'https://api.linkedin.com/v2/me'

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
    state,
    scope: 'r_liteprofile w_member_social',
  })
  return `${LINKEDIN_AUTHORIZE_URL}?${params}`
}

export async function exchangeCodeForToken(code: string): Promise<{ access_token: string; expires_in: number }> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
  })

  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })

  if (!res.ok) throw new Error(`LinkedIn token exchange failed: ${res.statusText}`)
  return res.json()
}

export async function getLinkedInProfile(accessToken: string): Promise<{ id: string; localizedFirstName: string; localizedLastName: string }> {
  const res = await fetch(LINKEDIN_ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch LinkedIn profile')
  return res.json()
}

export async function publishPost(accessToken: string, authorUrn: string, text: string): Promise<string> {
  const body = {
    author: `urn:li:person:${authorUrn}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  }

  const res = await fetch(LINKEDIN_UGC_POST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LinkedIn post failed: ${err}`)
  }

  const data = await res.json()
  return data.id as string
}
