<?php

namespace App\Events;

class VideoSyncEvent implements \Illuminate\Contracts\Broadcasting\ShouldBroadcast
{
    public $data;

    public function __construct($data)
    {
        $this->data = $data;
    }

    public function broadcastOn()
    {
        return new \Illuminate\Broadcasting\Channel('video-sync');
    }

    public function broadcastAs()
    {
        return 'video.sync';
    }
}