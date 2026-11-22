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
	Members  int          `json:"members,omitempty" doc:"How many are in it (the list; absent on one channel's own read)"`
	// Mine: the caller is in it, or follows it; a chat admin's other channels are listed too
	// (Other channels), without a badge.
	Mine      bool `json:"mine" doc:"In it or following: its badge and pushes count"`
	Following bool `json:"following,omitempty" doc:"A chat admin following a channel they are not in"`
	Archived  bool `json:"archived,omitempty" doc:"An archived group: read only, its history kept"`
	// The list only: the last people who wrote, newest first (at most 4).
	Faces []ChatFace `json:"faces,omitempty"`
}

// ChatFace is someone who wrote lately, as a small overlapping photo on the list.
type ChatFace struct {
	Name   string `json:"name"`
	Avatar string `json:"avatar,omitempty"`
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
		Members  []ChatMember `json:"members" nullable:"false" doc:"Everyone in it, with how far each has read: Seen by"`
		Messages int          `json:"messages" doc:"How many messages it has, for its info"`
	}
}

type ChatMember struct {
	ID     string `json:"id" format:"uuid"`
	Name   string `json:"name"`
	Avatar string `json:"avatar,omitempty"`
	ReadAt string `json:"readAt,omitempty" format:"date-time" doc:"Read everything up to here; absent: never opened"`
	Admin  bool   `json:"admin,omitempty" doc:"A chat admin (the owner, or chat level admin): deletes anyone's message"`
	VIP    bool   `json:"vip,omitempty" doc:"A VIP or an admin: the VIP badge"`
	// Follower: a chat admin following the channel, told of it but not one of its members.
	Follower bool `json:"follower,omitempty"`
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
	ClientKey string         `json:"clientKey,omitempty"`
	EditedAt  string         `json:"editedAt,omitempty" format:"date-time"`
	Deleted   bool           `json:"deleted,omitempty"`
	At        string         `json:"at" format:"date-time"`
	Photos    []ChatPhoto    `json:"photos,omitempty"`
	ReplyTo   *ChatQuote     `json:"replyTo,omitempty" doc:"The message this one answers, quoted above it"`
	Reactions []ChatReaction `json:"reactions,omitempty" doc:"Each emoji used, in the order first used"`
	Link      *ChatLink      `json:"link,omitempty" doc:"What it points at: a card that opens it, or a plain chip"`
}

// ChatLink is a shared screen (Step 75). With Open, the reader may open it and the card's
// details are filled; without, the phone shows a plain chip.
type ChatLink struct {
	Kind    string `json:"kind" enum:"day,pay_period,payout,whats_new"`
	ID      string `json:"id" doc:"A day's or a payout's id, a pay period's first day, a version"`
	Open    bool   `json:"open,omitempty"`
	Store   string `json:"store,omitempty"`
	StoreID string `json:"storeId,omitempty" format:"uuid"`
	Date    string `json:"date,omitempty" format:"date"`
	Cups    *int64 `json:"cups,omitempty"`
	Person  string `json:"person,omitempty"`
	UserID  string `json:"userId,omitempty" format:"uuid"`
	Start   string `json:"start,omitempty" format:"date"`
	End     string `json:"end,omitempty" format:"date"`
	Total   *int64 `json:"total,omitempty"`
	People  *int64 `json:"people,omitempty"`
	// What the screen shows at the top, so the chat reads it without opening it.
	Preview *LinkPreview `json:"preview,omitempty"`
}

// LinkPreview is a shared screen in small: a few numbers, then a short list. One shape for every
// kind, so the phone draws any of them with one card; labels are words the phone translates.
type LinkPreview struct {
	Status string        `json:"status,omitempty" enum:"open,closed,paid,pending,skipped"`
	Stats  []PreviewStat `json:"stats" nullable:"false"`
	Rows   []PreviewRow  `json:"rows,omitempty"`
	More   int           `json:"more,omitempty" doc:"Rows left out of the list"`
}

type PreviewStat struct {
	Label string `json:"label" enum:"sales,cups,orders,expenses,expected,counted,total,paid,toPay,people,commissions,claims"`
	Value int64  `json:"value"`
	Unit  string `json:"unit" enum:"money,count"`
}

type PreviewRow struct {
	Name   string `json:"name"`
	Avatar string `json:"avatar,omitempty"`
	Value  int64  `json:"value"`
	Unit   string `json:"unit" enum:"money,cups"`
	Status string `json:"status,omitempty" enum:"paid,pending,skipped"`
}

// ChatLinkInput is a screen shared into a chat.
type ChatLinkInput struct {
	Kind string `json:"kind" enum:"day,pay_period,payout"`
	ID   string `json:"id" maxLength:"100"`
}

// ChatReaction is one emoji on a message: who used it, and whether the caller did.
type ChatReaction struct {
	Emoji string   `json:"emoji"`
	Mine  bool     `json:"mine,omitempty"`
	Names []string `json:"names" nullable:"false"`
}

// ChatQuote is the message a reply answers, as its quote shows it.
type ChatQuote struct {
	ID      string `json:"id" format:"uuid"`
	Author  string `json:"author,omitempty"`
	Body    string `json:"body,omitempty"`
	Photo   bool   `json:"photo,omitempty" doc:"It had photos: the quote says Photo when there is no text"`
	Deleted bool   `json:"deleted,omitempty"`
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
		Body    string           `json:"body" maxLength:"4000" doc:"May be empty with photos"`
		Photos  []ChatPhotoInput `json:"photos,omitempty" maxItems:"4"`
		ReplyTo string           `json:"replyTo,omitempty" format:"uuid" doc:"A message of the same channel this one answers"`
		Link    *ChatLinkInput   `json:"link,omitempty" doc:"A backoffice screen shared here; the text may then be empty"`
	}
}

type ChatMessageInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid"`
	Msg    string `path:"message" format:"uuid"`
}

type ChatActivityInput struct {
	Tenant string `path:"tenant"`
	page.Input
}

type ChatActivityOutput struct {
	Body struct {
		page.Output[ChatActivity]
		Unread int `json:"unread" doc:"How many are unread, stops at 100: the Activity switch's count"`
	}
}

// ChatActivity is one message from someone else in the caller's channels (Activity).
type ChatActivity struct {
	ChatMessage
	ChannelID   string `json:"channelId" format:"uuid"`
	ChannelKind string `json:"channelKind" enum:"general,store,group,admin,personal"`
	ChannelName string `json:"channelName,omitempty"`
	Unread      bool   `json:"unread"`
	ToMe        bool   `json:"toMe,omitempty" doc:"A reply to one of the caller's messages"`
	MentionsMe  bool   `json:"mentionsMe,omitempty" doc:"@ the caller's name, or @everyone"`
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

type ChatReactionInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid"`
	Msg    string `path:"message" format:"uuid"`
	// The six reactions (RFC: Chat (v2)).
	Emoji string `path:"emoji" enum:"👍,❤️,😂,😮,😢,✅"`
}

type EditChatMessageInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid"`
	Msg    string `path:"message" format:"uuid"`
	Body   struct {
		Body string `json:"body" maxLength:"4000"`
	}
}

type ChatGroupBody struct {
	Name    string   `json:"name" minLength:"1" maxLength:"60"`
	Members []string `json:"members" maxItems:"500" doc:"Everyone in it; the tenant's active people only"`
}

type CreateChatGroupInput struct {
	Tenant string `path:"tenant"`
	Body   ChatGroupBody
}

type UpdateChatGroupInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid"`
	Body   struct {
		Name     *string `json:"name,omitempty" required:"false" minLength:"1" maxLength:"60"`
		Archived *bool   `json:"archived,omitempty" required:"false" doc:"Archived: read only, its history kept"`
	}
}

type SetChatGroupMembersInput struct {
	Tenant string `path:"tenant"`
	ID     string `path:"id" format:"uuid"`
	Body   struct {
		Members []string `json:"members" maxItems:"500" doc:"Everyone in it, the whole list"`
	}
}

type ChatGroupOutput struct {
	Body struct {
		ID string `json:"id" format:"uuid"`
	}
}

type ChatPeopleOutput struct {
	Body struct {
		People []ChatPerson `json:"people" nullable:"false" doc:"Everyone with a chat level: who a group can be made of"`
	}
}

type ChatPerson struct {
	ID     string `json:"id" format:"uuid"`
	Name   string `json:"name"`
	Avatar string `json:"avatar,omitempty"`
	// In: already in the group asked about (?group=).
	In bool `json:"in,omitempty"`
}

type ChatPeopleInput struct {
	Tenant string `path:"tenant"`
	Group  string `query:"group" required:"false" format:"uuid" doc:"Mark who is in this group"`
}

// UserChatGroups is UAC's Group chats: every group, and whether the person is in it.
type UserChatGroupsOutput struct {
	Body struct {
		Groups []UserChatGroup `json:"groups" nullable:"false"`
	}
}

type UserChatGroup struct {
	ID       string `json:"id" format:"uuid"`
	Name     string `json:"name"`
	Archived bool   `json:"archived,omitempty"`
	Member   bool   `json:"member"`
}

type SetUserChatGroupsInput struct {
	Tenant string `path:"tenant"`
	UserID string `path:"userId" format:"uuid"`
	Body   struct {
		Groups []string `json:"groups" maxItems:"500" doc:"Every group the person is in, the whole list"`
	}
}
