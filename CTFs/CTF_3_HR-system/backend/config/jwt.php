<?php

return [
    'secret' => env('JWT_SECRET', 'change-this-in-production'),
    'ttl' => env('JWT_TTL', 60), // minutes
    'refresh_ttl' => env('JWT_REFRESH_TTL', 20160), // 2 weeks in minutes
    'algo' => 'HS256',
];
