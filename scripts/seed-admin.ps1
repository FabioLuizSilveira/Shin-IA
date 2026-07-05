# scripts/seed-admin.ps1
# Seed local admin user for local development.

$url = "http://127.0.0.1:54321/auth/v1/signup"
$headers = @{
    "Content-Type" = "application/json"
    "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
}

$body = @{
    email = "admin@shina.com.br"
    password = "AdminPass123!"
    data = @{
        role = "admin"
        full_name = "Administrador Local"
    }
} | ConvertTo-Json

try {
    Write-Host "Creating admin user (admin@shina.com.br)..."
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body
    Write-Host "Admin user successfully created! User ID: $($response.id)"
} catch {
    Write-Error "Failed to seed admin user: $_"
}
