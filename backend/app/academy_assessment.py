"""Server-only question bank for account-backed Academy assessments."""

import secrets
import uuid

ASSESSMENT_QUESTIONS = {
    1: [
        ("A bank text asks you to verify your account through an urgent link. What is safest?",
         ["Open the link quickly", "Contact the bank using a trusted number", "Reply with your PIN"], 1),
        ("Which password practice best reduces credential-stuffing risk?",
         ["Reuse a memorable password", "Use a unique password for each account", "Add the year to one password"], 1),
        ("What should you do with a one-time login code?",
         ["Share it only with callers claiming to be support", "Keep it private", "Send it to verify your identity"], 1),
        ("What does HTTPS tell you about a website?",
         ["The connection is encrypted, not that the site is trustworthy", "The site is government-approved", "The site cannot be fraudulent"], 0),
        ("A message says your account will close unless you act immediately. This is most likely:",
         ["A reason to verify through an independent trusted channel", "Proof the message is genuine", "A request to share your password"], 0),
    ],
    2: [
        ("A mobile-money refund message asks for your OTP. What should you do?",
         ["Provide it to receive the refund", "Keep it private and contact the provider independently", "Forward it to the sender"], 1),
        ("Why use multi-factor authentication?",
         ["It can add a second check if a password is stolen", "It makes passwords unnecessary", "It guarantees accounts cannot be compromised"], 0),
        ("A browser shows an invalid certificate warning on a login page. You should:",
         ["Stop and verify the site through a trusted route", "Disable the warning", "Enter credentials before it expires"], 0),
        ("What is a safe response to an unexpected support call requesting a login code?",
         ["Read the code to the caller", "End the call and contact support using a trusted channel", "Share a screenshot instead"], 1),
        ("A public Wi-Fi network is open. Which action is safest for banking?",
         ["Avoid sensitive transactions or use a trusted secured connection", "Assume it is safe if the venue is busy", "Turn off device updates"], 0),
    ],
    3: [
        ("A chat account asks for a one-time code to prevent suspension. You should:",
         ["Send the code to the account", "Refuse and report the message through official channels", "Post the code publicly"], 1),
        ("Why is app-based TOTP generally safer than SMS against SIM swapping?",
         ["Codes are generated on the device rather than delivered by SMS", "It needs no account security", "It prevents every phishing attack"], 0),
        ("After entering a password on a suspected phishing page, first:",
         ["Change it from a trusted device and revoke other sessions", "Wait to see if anything happens", "Delete the browser history only"], 0),
        ("What is the primary purpose of Content-Security-Policy?",
         ["Restrict allowed content sources to help mitigate script injection", "Encrypt stored database records", "Verify a site's business identity"], 0),
        ("A familiar domain has a look-alike spelling. You should:",
         ["Check the exact domain through a trusted source before signing in", "Trust its logo", "Assume HTTPS proves ownership"], 0),
    ],
    4: [
        ("A tailored message references your workplace and demands urgent payment. You should:",
         ["Verify the request using a separate known contact route", "Reply with payment details", "Forward it to colleagues as confirmed"], 0),
        ("You suspect a SIM swap because service suddenly stopped. Prioritize:",
         ["Contact the carrier through a trusted channel and secure accounts", "Share OTPs with anyone who calls", "Wait several days"], 0),
        ("Which is a safer way to preserve incident evidence?",
         ["Keep original messages and record relevant times without altering them", "Edit screenshots to remove context", "Delete logs after reporting"], 0),
        ("Why set Secure and HttpOnly on session cookies?",
         ["Restrict cookie transmission to HTTPS and access from client scripts", "Make sessions permanent", "Replace server-side authorization"], 0),
        ("What does rate limiting help defend against?",
         ["Repeated automated requests such as password guessing", "All malicious email", "Physical device theft"], 0),
    ],
    5: [
        ("A cloud access key appears in a public repository. A strong first response is:",
         ["Revoke or rotate it and investigate its use", "Hide the repository and assume the key is safe", "Post the key in an incident report"], 0),
        ("Why revoke active sessions after suspected account compromise?",
         ["It can invalidate sessions an attacker may already control", "It changes the user's email address", "It removes all malware from the device"], 0),
        ("What does TLS protect in transit?",
         ["Confidentiality and integrity of the connection, not the honesty of the site", "The accuracy of every page's claims", "The server from all compromise"], 0),
        ("Credential stuffing is best reduced by:",
         ["Unique passwords, MFA, and abuse detection/rate limits", "One shared password", "Disabling account alerts"], 0),
        ("A ransomware note appears. What is a safer initial action?",
         ["Isolate affected systems per incident procedure and preserve evidence", "Run random cleanup tools on every device", "Pay immediately without verification"], 0),
    ],
    6: [
        ("What is a core Zero Trust principle?",
         ["Verify each access request using context and policy", "Trust all devices on an internal network", "Use one shared administrator account"], 0),
        ("Why segment critical infrastructure networks?",
         ["Limit unintended access and contain compromise", "Make all devices publicly reachable", "Replace backups"], 0),
        ("What is defense in depth?",
         ["Layering controls so one failure does not defeat all protection", "Using only one strong firewall", "Avoiding incident response plans"], 0),
        ("Which practice helps protect software supply chains?",
         ["Verify dependencies and build provenance", "Install unreviewed packages automatically", "Share signing keys among developers"], 0),
        ("What should a post-incident review prioritize?",
         ["Evidence-based causes, recovery, and preventive improvements", "Assigning blame before investigation", "Deleting records to close the incident"], 0),
    ],
}

PASS_THRESHOLD = 80
ATTEMPT_LIMIT_PER_DAY = 5
ATTEMPT_LIFETIME_MINUTES = 30


def build_attempt_questions(level_num: int) -> list[dict]:
    questions = list(ASSESSMENT_QUESTIONS[level_num])
    secrets.SystemRandom().shuffle(questions)
    result = []
    for prompt, source_options, correct_index in questions:
        options = [{"id": str(uuid.uuid4()), "text": text} for text in source_options]
        secrets.SystemRandom().shuffle(options)
        result.append({
            "id": str(uuid.uuid4()),
            "prompt": prompt,
            "options": options,
            "correct_option_id": options[
                next(index for index, option in enumerate(options)
                     if option["text"] == source_options[correct_index])
            ]["id"],
        })
    return result
