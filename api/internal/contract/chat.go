package contract

type ChatChannelsOutput struct {
	Body struct {
		Channels []ChatChannel `json:"channels" nullable:"false" doc:"The caller's channels, the newest message first"`
	}
}

type ChatChannel struct {
	ID   string `json:"id" format:"uuid"`
	Kind string `json:"kind" enum:"general,store,group,admin,personal"`
	// A store's name, or a group's; the others show a translated label from the kind.
	Name     string       `json:"name,omitempty"`
	ReadOnly bool         `json:"readOnly" doc:"Nobody posts: Notifications, or a store no longer open"`
	LastAt   string       `json:"lastAt,omitempty" format:"date-time"`
	Last     *ChatPreview `json:"last,omitempty"`
	Unread   int          `json:"unread" doc:"Stops at 100: show 99+"`
}

// ChatPreview is a channel's last message, one line on the list.
type ChatPreview struct {
	Mine    bool           `json:"mine"`
	Author  string         `json:"author,omitempty"`
	Body    string         `json:"body,omitempty"`
	Event   string         `json:"event,omitempty" doc:"A system message's kind, written in the reader's language"`
	Data    map[string]any `json:"data,omitempty" doc:"A system message's numbers"`
	Deleted bool           `json:"deleted,omitempty"`
}

type ChatChannelInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid"`
}

type ChatChannelOutput struct {
	Body struct {
		ChatChannel
		Members []ChatMember `json:"members" nullable:"false" doc:"Everyone in it, with how far each has read: Seen by"`
	}
}

type ChatMember struct {
	ID     string `json:"id" format:"uuid"`
	Name   string `json:"name"`
	Avatar string `json:"avatar,omitempty"`
	ReadAt string `json:"readAt,omitempty" format:"date-time" doc:"Read everything up to here; absent: never opened"`
}
