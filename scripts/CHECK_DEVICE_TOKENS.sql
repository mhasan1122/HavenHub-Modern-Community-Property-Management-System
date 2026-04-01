-- Check all device tokens in the database
SELECT 
    id,
    member_id,
    SUBSTRING(push_token, 1, 30) as token_preview,
    device_type,
    device_id,
    is_active,
    created_at,
    updated_at,
    last_used_at
FROM notifications_devicetoken
ORDER BY id DESC;

-- Check specifically for member_id 41 (the user who just logged in)
SELECT 
    id,
    member_id,
    push_token,
    device_type,
    device_id,
    is_active,
    created_at,
    updated_at,
    last_used_at
FROM notifications_devicetoken
WHERE member_id = 41
ORDER BY id DESC;

-- Count total device tokens
SELECT COUNT(*) as total_tokens FROM notifications_devicetoken;

-- Count active device tokens
SELECT COUNT(*) as active_tokens FROM notifications_devicetoken WHERE is_active = 1;

-- Check the most recent device token (should be ID 10)
SELECT 
    id,
    member_id,
    push_token,
    device_type,
    device_id,
    is_active,
    created_at,
    updated_at,
    last_used_at
FROM notifications_devicetoken
WHERE id = 10;
