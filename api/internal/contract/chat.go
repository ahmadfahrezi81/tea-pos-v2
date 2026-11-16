package contract

import "github.com/ahmadfahrezi81/tea-pos-v2/api/internal/page"

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
	Admin  bool   `json:"admin,omitempty" doc:"A chat admin (the owner, or chat level admin): the VIP badge"`
}

type ChatMessagesInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid"`
	page.Input
}

type ChatMessagesOutput struct {
	// Newest first; with since, only what came after it, oldest first.
	Body page.Output[ChatMessage]
}

type ChatMessage struct {
	ID       string         `json:"id" format:"uuid"`
	AuthorID string         `json:"authorId,omitempty" format:"uuid" doc:"Absent on a system message"`
	Author   string         `json:"author,omitempty"`
	Avatar   string         `json:"avatar,omitempty"`
	Event    string         `json:"event,omitempty" doc:"A system message's kind, written in the reader's language"`
	Data     map[string]any `json:"data,omitempty"`
	Body     string         `json:"body"`
	// The phone's Idempotency-Key, so it swaps its own copy for this one.
	ClientKey string      `json:"clientKey,omitempty"`
	EditedAt  string      `json:"editedAt,omitempty" format:"date-time"`
	Deleted   bool        `json:"deleted,omitempty"`
	At        string      `json:"at" format:"date-time"`
	Photos    []ChatPhoto `json:"photos,omitempty"`
}

// ChatPhoto is one of a message's photos: signed addresses that work for a few hours.
type ChatPhoto struct {
	URL        string `json:"url"`
	PreviewURL string `json:"previewUrl"`
	Width      int    `json:"width"`
	Height     int    `json:"height"`
}

// ChatPhotoInput is a photo the phone has uploaded (purpose chat_photo), in both sizes.
type ChatPhotoInput struct {
	Path        string `json:"path" maxLength:"300"`
	PreviewPath string `json:"previewPath" maxLength:"300"`
	Width       int    `json:"width" minimum:"1" maximum:"4096"`
	Height      int    `json:"height" minimum:"1" maximum:"4096"`
}

type PostChatMessageInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid"`
	Key    string `header:"Idempotency-Key"`
	Body   struct {
		Body   string           `json:"body" maxLength:"4000" doc:"May be empty with photos"`
		Photos []ChatPhotoInput `json:"photos,omitempty" maxItems:"4"`
	}
}

type ChatMessageOutput struct {
	Body ChatMessage
}

type ReadChatInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid"`
	Body   struct {
		At string `json:"at" format:"date-time" doc:"Everything up to this message's time is read; only ever moves forward"`
	}
}

type ChatTypingInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid"`
}
