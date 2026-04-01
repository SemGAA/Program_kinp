<?php

namespace App\Events;

class MovieNoteEvent implements \Illuminate\Contracts\Broadcasting\ShouldBroadcast
{
    public $note;
    public $action; // 'created', 'sent', 'accepted', 'rejected'

    public function __construct($note, $action)
    {
        $this->note = $note;
        $this->action = $action;
    }

    public function broadcastOn()
    {
        return new \Illuminate\Broadcasting\Channel('notes');
    }

    public function broadcastAs()
    {
        return 'note.updated';
    }
}