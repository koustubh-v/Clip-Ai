# GCP Automation Setup Guide

To automate your deployments to GCP when you push to GitHub, we have set up a GitHub Actions workflow in `.github/workflows/deploy.yml`. 

Follow these exact steps to connect your GitHub repository to your Google Cloud Project (`clipai-4bb71`) so the automation works securely.

## Step 1: Enable Required GCP APIs
Go to the [Google Cloud Console](https://console.cloud.google.com/) and ensure your project (`clipai-4bb71`) is selected.
Open the Cloud Shell (terminal icon in the top right) or run these commands locally using `gcloud`:
```bash
gcloud services enable run.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    cloudbuild.googleapis.com \
    iamcredentials.googleapis.com
```

## Step 2: Create an Artifact Registry
This is where your Docker images will be stored before deploying to Cloud Run.
```bash
gcloud artifacts repositories create backend-repo \
    --repository-format=docker \
    --location=us-central1 \
    --description="Docker repository for ClipAI Backend"
```

## Step 3: Secure Your Gemini API Key
Instead of putting your Gemini API key in plain text, store it in GCP Secret Manager.
```bash
echo -n "YOUR_GEMINI_API_KEY_HERE" | gcloud secrets create GOOGLE_API_KEY --data-file=-
```

## Step 4: Setup a Service Account for GitHub Actions
We need a service account that GitHub Actions can use to deploy to GCP.
```bash
# 1. Create the service account
gcloud iam service-accounts create github-actions \
    --display-name="GitHub Actions Deployer"

# 2. Grant permissions
PROJECT_ID="clipai-4bb71"
SA_EMAIL="github-actions@${PROJECT_ID}.iam.gserviceaccount.com"

# Allow it to push to Artifact Registry
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/artifactregistry.writer"

# Allow it to deploy to Cloud Run
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/run.developer"

# Allow it to act as a service account (required for Cloud Run)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/iam.serviceAccountUser"

# Allow it to access secrets
gcloud secrets add-iam-policy-binding GOOGLE_API_KEY \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor"

# 3. Generate a JSON Key for GitHub
gcloud iam service-accounts keys create gcp-key.json \
    --iam-account=${SA_EMAIL}
```

## Step 5: Add Secrets to GitHub
1. Open the downloaded `gcp-key.json` file and copy all its contents.
2. Go to your GitHub Repository > **Settings** > **Secrets and variables** > **Actions**.
3. Click **New repository secret**.
4. Name: `GCP_CREDENTIALS`
5. Value: Paste the contents of `gcp-key.json`
6. Click **Add secret**.

For the frontend deployment to Firebase Hosting, you will also need to add `FIREBASE_SERVICE_ACCOUNT`:
7. You already have a `serviceAccountKey.json` for Firebase Admin. Copy its contents.
8. Create another **New repository secret**.
9. Name: `FIREBASE_SERVICE_ACCOUNT`
10. Value: Paste the contents of `serviceAccountKey.json`.

## Step 6: Push Code to Trigger
Once the secrets are added, push your code to the `main` branch.
```bash
git add .
git commit -m "Configure GCP CI/CD Pipeline"
git push origin main
```
Go to your GitHub repo's **Actions** tab to watch the deployment run. It will automatically build the API container, push it to GCP, deploy the Cloud Run service, and then deploy your frontend to Firebase Hosting!
