<?php

namespace App\Events;

class MessageEvent implements \Illuminate\Contracts\Broadcasting\ShouldBroadcast
{
    public $message;
    public $roomId;

    public function __construct($roomId, $message)
    {
        $this->roomId = $roomId;
        $this->message = $message;
    }

    public function broadcastOn()
    {
        return new \Illuminate\Broadcasting\Channel('chat.' . $this->roomId);
    }

    public function broadcastAs()
    {
        return 'message.sent';
    }
}