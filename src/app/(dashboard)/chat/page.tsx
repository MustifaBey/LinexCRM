"use client";

import { useState, useEffect, useRef } from "react";
import { 
  getTeamChatMessages, 
  sendTeamChatMessage, 
  getChatChannels, 
  createChatChannel, 
  deleteChatChannel,
  votePoll
} from "@/actions/team_chat";
import { uploadFileToServer } from "@/actions/storage";
import { createClient } from "@/lib/supabase/client";
import { useSupabase } from "@/providers/supabase-provider";
import {
  Send,
  Paperclip,
  Image,
  Loader2,
  Hash,
  X,
  MessageSquare,
  BarChart2,
  Trash2,
  Plus,
  User,
  Vote,
  Check,
  ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function TeamChatPage() {
  const { user } = useSupabase();
  const supabase = createClient();
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  
  // Loading states
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isVotingMap, setIsVotingMap] = useState<{ [key: string]: boolean }>({});
  
  // File preview
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Modals state
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);

  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptionsInputs, setPollOptionsInputs] = useState<string[]>(["", ""]);
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);

  // Message Delete states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleDeleteMessageSubmit = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!selectedMessageId) return;

    const messageIdToDelete = selectedMessageId;

    // 1. Release the UI immediately to prevent hanging
    setIsDeletingMessage(false);
    setShowDeleteModal(false);
    setSelectedMessageId(null);
    setMessages((prev) => prev.filter((msg) => msg.id !== messageIdToDelete));

    // 2. TypeScript-friendly inner async function (Fire and Forget)
    const fireAndForgetDelete = async () => {
      try {
        const response = await supabase
          .from('team_chat')
          .delete()
          .eq('id', messageIdToDelete);

        console.log("Supabase Arka Plan Yanıtı:", response);
        if (response.error) {
          toast.error("Veritabanı silme hatası: " + response.error.message);
        } else if (response.status !== 200 && response.status !== 204) {
          toast.error("Silme işlemi RLS veya yetki tarafından engellendi.");
        } else {
          toast.success("Mesaj başarıyla silindi.");
        }
      } catch (error) {
        console.error("Kritik JS Hatası:", error);
      }
    };

    // 3. Trigger the deletion in the background without awaiting it
    fireAndForgetDelete();
  };


  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Fetch channels on mount
  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    setIsLoadingChannels(true);
    const res = await getChatChannels();
    if (res.error) {
      toast.error("Kanallar alınamadı: " + res.error);
    } else {
      const fetchedChannels = res.data || [];
      setChannels(fetchedChannels);

      // Select default 'genel-sohbet' or the first channel
      if (fetchedChannels.length > 0) {
        const defaultChan = fetchedChannels.find((c: any) => c.name === "genel-sohbet") || fetchedChannels[0];
        setSelectedChannel(defaultChan);
      }
    }
    setIsLoadingChannels(false);
  };

  // 2. Fetch messages when channel changes
  useEffect(() => {
    if (selectedChannel?.id) {
      fetchMessages(selectedChannel.id);
    } else {
      setMessages([]);
    }
  }, [selectedChannel?.id]);

  const fetchMessages = async (channelId: string, silent = false) => {
    if (!silent) setIsLoadingMessages(true);
    const res = await getTeamChatMessages(channelId);
    if (res.error) {
      toast.error("Mesajlar alınamadı: " + res.error);
    } else {
      setMessages(res.data || []);
      if (!silent) {
        setTimeout(scrollToBottom, 100);
      }
    }
    if (!silent) setIsLoadingMessages(false);
  };

  // 3. Realtime subscription setup for active channel & channels table
  useEffect(() => {
    const supabase = createClient();

    // Messages sync channel
    let msgChannel: any;
    if (selectedChannel?.id) {
      msgChannel = supabase
        .channel(`team-chat-chan-${selectedChannel.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "team_chat",
            filter: `channel_id=eq.${selectedChannel.id}`,
          },
          (payload: any) => {
            if (payload.eventType === "DELETE") {
              setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
            } else {
              // Refetch messages silently to capture attachments, polls, or vote updates for INSERT/UPDATE
              fetchMessages(selectedChannel.id, true);
            }
          }
        )
        .subscribe();
    }

    // Channels sync channel
    const channelsChannel = supabase
      .channel("chat-channels-sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_channels",
        },
        async (payload) => {
          // Silent fetch channels
          const res = await getChatChannels();
          if (res.data) {
            setChannels(res.data);
            
            // If the currently selected channel was deleted, select first available
            if (payload.eventType === "DELETE" && selectedChannel && payload.old.id === selectedChannel.id) {
              const defaultChan = res.data.find((c: any) => c.name === "genel-sohbet") || res.data[0];
              setSelectedChannel(defaultChan || null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (msgChannel) supabase.removeChannel(msgChannel);
      supabase.removeChannel(channelsChannel);
    };
  }, [selectedChannel?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };



  // File Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error("Lütfen geçerli bir görsel veya video dosyası seçin.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Dosya boyutu 10MB'tan küçük olmalıdır.");
      return;
    }

    setSelectedFile(file);
    const previewUrl = URL.createObjectURL(file);
    setFilePreview(previewUrl);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Channel actions UI callbacks
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    setIsCreatingChannel(true);
    const res = await createChatChannel(newChannelName);
    setIsCreatingChannel(false);

    if (res.error) {
      toast.error("Kanal oluşturulamadı: " + res.error);
    } else {
      toast.success("Kanal başarıyla oluşturuldu.");
      setNewChannelName("");
      setShowChannelModal(false);
      // Fetch fresh channels list
      const freshRes = await getChatChannels();
      if (freshRes.data) {
        setChannels(freshRes.data);
        const newChan = freshRes.data.find((c: any) => c.id === res.data.id);
        if (newChan) setSelectedChannel(newChan);
      }
    }
  };

  const handleDeleteChannel = async (channelId: string, channelName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`"#${channelName}" kanalını silmek istediğinize emin misiniz? Kanaldaki tüm mesaj geçmişi kalıcı olarak silinecektir.`)) {
      return;
    }

    const res = await deleteChatChannel(channelId);
    if (res.error) {
      toast.error("Kanal silinemedi: " + res.error);
    } else {
      toast.success("Kanal silindi.");
      fetchChannels();
    }
  };

  // Poll option fields builders
  const handleAddPollOptionInput = () => {
    if (pollOptionsInputs.length >= 6) {
      toast.error("En fazla 6 seçenek ekleyebilirsiniz.");
      return;
    }
    setPollOptionsInputs([...pollOptionsInputs, ""]);
  };

  const handleRemovePollOptionInput = (index: number) => {
    if (pollOptionsInputs.length <= 2) {
      toast.error("En az 2 seçenek olmalıdır.");
      return;
    }
    setPollOptionsInputs(pollOptionsInputs.filter((_, i) => i !== index));
  };

  const handlePollOptionValueChange = (index: number, val: string) => {
    const updated = [...pollOptionsInputs];
    updated[index] = val;
    setPollOptionsInputs(updated);
  };

  // Create Poll submission
  const handleCreatePollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannel) return;
    if (!pollQuestion.trim()) {
      toast.error("Lütfen anket sorusunu yazın.");
      return;
    }

    const cleanOptions = pollOptionsInputs.filter((opt) => opt.trim() !== "");
    if (cleanOptions.length < 2) {
      toast.error("Lütfen en az 2 geçerli seçenek girin.");
      return;
    }

    setIsCreatingPoll(true);
    const optionsPayload = cleanOptions.map((text, idx) => ({
      id: (idx + 1).toString(),
      text: text.trim(),
      votes: [],
    }));

    const res = await sendTeamChatMessage({
      channelId: selectedChannel.id,
      isPoll: true,
      pollQuestion: pollQuestion.trim(),
      pollOptions: optionsPayload,
    });

    setIsCreatingPoll(false);

    if (res.error) {
      toast.error("Anket gönderilemedi: " + res.error);
    } else {
      toast.success("Anket başarıyla paylaşıldı.");
      setPollQuestion("");
      setPollOptionsInputs(["", ""]);
      setShowPollModal(false);
      fetchMessages(selectedChannel.id, true);
    }
  };

  // Vote option click
  const handleVoteOption = async (messageId: string, optionId: string) => {
    if (isVotingMap[messageId]) return;

    setIsVotingMap((prev) => ({ ...prev, [messageId]: true }));
    const res = await votePoll(messageId, optionId);
    setIsVotingMap((prev) => ({ ...prev, [messageId]: false }));

    if (res.error) {
      toast.error("Oy kullanılamadı: " + res.error);
    } else {
      // Refresh feed silently
      if (selectedChannel) {
        fetchMessages(selectedChannel.id, true);
      }
    }
  };

  // Standard chat sending
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannel) return;
    if (!inputText.trim() && !selectedFile) return;

    setIsSending(true);
    let uploadedMediaUrl = "";

    if (selectedFile) {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("bucket", "chat_media");
      formData.append("path", `team_chat/${Date.now()}_${selectedFile.name}`);

      const uploadRes = await uploadFileToServer(formData);
      setIsUploading(false);

      if (uploadRes.error) {
        toast.error("Medya yüklenemedi: " + uploadRes.error);
        setIsSending(false);
        return;
      }
      uploadedMediaUrl = uploadRes.publicUrl || "";
    }

    const text = inputText;
    setInputText("");
    handleRemoveFile();

    const res = await sendTeamChatMessage({
      channelId: selectedChannel.id,
      message: text || undefined,
      mediaUrl: uploadedMediaUrl || undefined,
    });

    if (res.error) {
      toast.error("Mesaj gönderilemedi: " + res.error);
    } else {
      fetchMessages(selectedChannel.id, true);
    }
    setIsSending(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatDateHeader = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  };

  // Group messages
  const groupedMessages: { [key: string]: any[] } = {};
  messages.forEach((msg) => {
    const dateKey = new Date(msg.created_at).toDateString();
    if (!groupedMessages[dateKey]) {
      groupedMessages[dateKey] = [];
    }
    groupedMessages[dateKey].push(msg);
  });

  return (
    <div className="h-[calc(100vh-100px)] flex border border-border bg-card/10 rounded-2xl overflow-hidden select-none">
      
      {/* SIDEBAR: Dynamic Channels List */}
      <div className="hidden md:flex w-60 border-r border-border bg-card/15 flex-col shrink-0">
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
          <span className="font-extrabold text-sm text-foreground">Linex Medya Sohbet</span>
        </div>

        {/* Channels scroll area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Metin Kanalları</span>
              <button 
                onClick={() => setShowChannelModal(true)}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                title="Yeni Kanal Oluştur"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="space-y-0.5 mt-2">
              {isLoadingChannels ? (
                <div className="flex items-center justify-center py-4 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-burgundy" />
                </div>
              ) : (
                channels.map((chan) => {
                  const isActive = selectedChannel?.id === chan.id;
                  const isDefault = chan.name === "genel-sohbet";
                  return (
                    <div
                      key={chan.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedChannel(chan)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedChannel(chan);
                        }
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold group transition-all text-left cursor-pointer outline-none select-none",
                        isActive 
                          ? "bg-burgundy/10 text-burgundy font-bold border-l-2 border-burgundy"
                          : "text-muted-foreground hover:bg-card/30 hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Hash className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-burgundy" : "text-muted-foreground/60")} />
                        <span className="truncate">{chan.name}</span>
                      </div>
                      
                      {/* Delete button on hover (staff only, excluding default channel) */}
                      {!isDefault && (
                        <button
                          onClick={(e) => handleDeleteChannel(chan.id, chan.name, e)}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 rounded transition-all cursor-pointer"
                          title="Kanalı Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CHAT AREA: Channel Header, Feed, Input */}
      <div className="flex-1 flex flex-col bg-background overflow-hidden relative">
        
        {/* Channel Header */}
        <div className="p-3 md:p-4 border-b border-border bg-card/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Hash className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground shrink-0" />
            {/* Mobile Channel Selector dropdown */}
            <div className="block md:hidden relative">
              <select
                value={selectedChannel?.id || ""}
                onChange={(e) => {
                  const selected = channels.find((chan) => chan.id === e.target.value);
                  if (selected) setSelectedChannel(selected);
                }}
                className="bg-card text-foreground text-xs font-bold border border-border/80 rounded-xl pl-2.5 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-burgundy appearance-none cursor-pointer"
              >
                {channels.map((chan) => (
                  <option key={chan.id} value={chan.id}>
                    #{chan.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Desktop Channel Title */}
            <h3 className="hidden md:block font-extrabold text-sm text-foreground">
              {selectedChannel ? selectedChannel.name : "Kanal Seçilmedi"}
            </h3>

            {selectedChannel && (
              <>
                <span className="hidden sm:inline text-muted-foreground text-xs font-medium">|</span>
                <p className="hidden sm:inline text-muted-foreground text-xs leading-none">
                  #{selectedChannel.name} odasında anlık koordinasyon ve sohbet.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Message Feed Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
          {!selectedChannel ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground select-none">
              <MessageSquare className="w-10 h-10 mb-2" />
              <span className="text-xs">Sohbete başlamak için bir kanal seçin.</span>
            </div>
          ) : isLoadingMessages ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-burgundy mb-2" />
              <span className="text-xs">Mesaj geçmişi yükleniyor...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center select-none">
              <MessageSquare className="w-10 h-10 text-muted-foreground/60 mb-2" />
              <h4 className="font-bold text-sm text-foreground">#{selectedChannel.name} kanalına hoş geldiniz!</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                Bu kanalın başlangıcıdır. İlk mesajı siz yazarak sohbete başlayın!
              </p>
            </div>
          ) : (
            Object.keys(groupedMessages).map((dateKey) => {
              const msgs = groupedMessages[dateKey];
              return (
                <div key={dateKey} className="space-y-4">
                  {/* Date Divider */}
                  <div className="relative flex items-center justify-center select-none py-1">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border/40"></div>
                    </div>
                    <span className="relative px-3.5 bg-background text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider">
                      {formatDateHeader(msgs[0].created_at)}
                    </span>
                  </div>

                  {msgs.map((m) => {
                    const isPoll = m.is_poll;
                    return (
                      <div key={m.id} className="flex items-start gap-3.5 hover:bg-card/5 p-1 rounded-xl transition-all group relative">
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-burgundy/10 border border-burgundy/25 flex items-center justify-center overflow-hidden shrink-0 select-none">
                          {m.sender?.avatar_url ? (
                            <img src={m.sender.avatar_url} alt="" className="object-cover w-full h-full" />
                          ) : (
                            <User className="w-4 h-4 text-burgundy" />
                          )}
                        </div>

                        {/* Message body */}
                        <div className="flex-1 space-y-1.5 min-w-0 pr-8">
                          {/* Name and time */}
                          <div className="flex items-center gap-2 text-xs select-none">
                            <span className="font-bold text-foreground hover:underline cursor-pointer">
                              {m.sender?.full_name || "Ekip Üyesi"}
                            </span>
                            <span className={cn(
                              "text-[8px] font-black uppercase px-1 py-0.5 rounded border scale-95",
                              m.sender?.role === "owner" && "bg-red-950/30 text-red-400 border-red-900/30",
                              m.sender?.role === "admin" && "bg-amber-950/30 text-amber-400 border-amber-900/30",
                              m.sender?.role === "member" && "bg-blue-950/30 text-blue-400 border-blue-900/30"
                            )}>
                              {m.sender?.role === "owner" ? "Kurucu" : m.sender?.role === "admin" ? "Yönetici" : "Üye"}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60">{formatDate(m.created_at)}</span>
                          </div>

                          {/* Message Content (Normal text) */}
                          {m.message && !isPoll && (
                            <p className="text-xs text-foreground/90 whitespace-pre-wrap break-words leading-relaxed select-text">
                              {m.message}
                            </p>
                          )}

                          {/* POLL RENDER BLOCK */}
                          {isPoll && (
                            <div className="mt-2 p-5 rounded-2xl bg-card border border-border/70 max-w-lg space-y-4 shadow-lg relative overflow-hidden select-none">
                              <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                                <Vote className="w-5 h-5 text-burgundy" />
                                <span className="text-xs font-black text-foreground uppercase tracking-wide">Linex Ekip Anketi</span>
                              </div>
                              
                              <h4 className="text-sm font-extrabold text-foreground leading-snug">{m.poll_question}</h4>

                              {/* Options loop */}
                              <div className="space-y-2.5 pt-1">
                                {(() => {
                                  const opts = m.poll_options || [];
                                  const totalVotes = opts.reduce((sum: number, o: any) => sum + (o.votes?.length || 0), 0);
                                  
                                  return opts.map((opt: any) => {
                                    const userVoted = opt.votes?.includes(user?.id);
                                    const votesCount = opt.votes?.length || 0;
                                    const percentage = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
                                    const isVoting = isVotingMap[m.id];

                                    return (
                                      <button
                                        key={opt.id}
                                        onClick={() => handleVoteOption(m.id, opt.id)}
                                        disabled={isVoting}
                                        className={cn(
                                          "w-full p-3.5 rounded-xl border text-left text-xs font-semibold relative overflow-hidden transition-all flex items-center justify-between gap-4 cursor-pointer",
                                          userVoted
                                            ? "border-burgundy/40 text-burgundy"
                                            : "border-border/80 text-foreground hover:bg-muted/30"
                                        )}
                                      >
                                        {/* Filled background progress indicator */}
                                        <div 
                                          className={cn(
                                            "absolute left-0 top-0 bottom-0 transition-all duration-300 -z-10",
                                            userVoted ? "bg-burgundy/10" : "bg-muted/40"
                                          )}
                                          style={{ width: `${percentage}%` }}
                                        />

                                        <div className="flex items-center gap-2 min-w-0">
                                          {userVoted && <Check className="w-4 h-4 text-burgundy shrink-0" />}
                                          <span className="truncate">{opt.text}</span>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0 font-mono text-[10px] text-muted-foreground/80">
                                          <span>{votesCount} Oy</span>
                                          <span className="font-bold text-foreground">({percentage}%)</span>
                                        </div>
                                      </button>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          )}

                          {/* Media attachments */}
                          {m.media_url && (
                            <div className="mt-2.5 max-w-sm rounded-2xl overflow-hidden border border-border/60 bg-muted/20 select-none">
                              {m.media_url.endsWith(".mp4") ? (
                                <video src={m.media_url} controls className="max-h-60 w-auto object-contain" />
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={m.media_url} alt="Paylaşılan medya" className="max-h-60 w-auto object-contain hover:scale-[1.01] transition-all duration-300" />
                              )}
                            </div>
                          )}
                        </div>

                        {/* NEW: Delete Button */}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDeletingMessage(false); // guard: reset stale state from any previous in-flight delete
                            setSelectedMessageId(m.id);
                            setShowDeleteModal(true);
                          }}
                          className="absolute right-2 top-2 md:right-4 md:top-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 md:p-2 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all cursor-pointer z-10"
                          title="Mesajı Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar Form */}
        <form onSubmit={handleSendMessage} className="p-4 bg-card/5 border-t border-border flex flex-col shrink-0 gap-3">
          
          {/* File preview badge */}
          {filePreview && (
            <div className="flex items-center gap-3 bg-card border border-border p-2 rounded-xl w-fit shrink-0 relative animate-in slide-in-from-bottom duration-250 select-none">
              <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex items-center justify-center border border-border">
                {selectedFile?.type.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={filePreview} alt="Preview" className="object-cover w-full h-full" />
                ) : (
                  <Image className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-foreground truncate max-w-[150px]">{selectedFile?.name}</p>
                <p className="text-[9px] text-muted-foreground">{(selectedFile!.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="p-1 rounded-full bg-red-950/40 text-red-400 border border-red-900/40 hover:bg-red-950/60 ml-2 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Form Controls */}
          <div className="flex gap-3 items-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,video/*"
              className="hidden"
            />
            
            {/* Attachment Trigger */}
            <button
              type="button"
              disabled={!selectedChannel}
              onClick={() => fileInputRef.current?.click()}
              className="w-11 h-11 rounded-xl border border-border bg-card/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center justify-center shrink-0 disabled:opacity-50"
              title="Medya Yükle"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Poll Builder Trigger */}
            <button
              type="button"
              disabled={!selectedChannel}
              onClick={() => setShowPollModal(true)}
              className="w-11 h-11 rounded-xl border border-border bg-card/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center justify-center shrink-0 disabled:opacity-50"
              title="Anket Oluştur"
            >
              <BarChart2 className="w-4 h-4" />
            </button>


            {/* Message input */}
            <input
              type="text"
              required={!selectedFile}
              disabled={!selectedChannel || isUploading}
              placeholder={
                !selectedChannel 
                  ? "Sohbete yazmak için bir kanal seçin..."
                  : isUploading 
                  ? "Medya yükleniyor..." 
                  : `#${selectedChannel.name} odasına yazın...`
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 h-11 px-4 rounded-xl bg-card border border-border text-xs focus:outline-none focus:ring-2 focus:ring-ring transition-all disabled:opacity-50"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!selectedChannel || isSending || isUploading || (!inputText.trim() && !selectedFile)}
              className="w-11 h-11 rounded-xl bg-burgundy hover:bg-burgundy-light disabled:opacity-45 text-white transition-all flex items-center justify-center shrink-0"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </form>
      </div>

      {/* MODAL 1: Create Channel */}
      {showChannelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isCreatingChannel && setShowChannelModal(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 z-10">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-sm font-extrabold flex items-center gap-2">
                <Hash className="w-5 h-5 text-burgundy" />
                <span>Yeni Metin Kanalı Oluştur</span>
              </h2>
              <button
                onClick={() => setShowChannelModal(false)}
                disabled={isCreatingChannel}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateChannel}>
              <div className="px-6 py-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Kanal Adı
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: tasarim-revizyon, proje-planlama"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    disabled={isCreatingChannel}
                    className="w-full h-11 px-4 rounded-xl bg-input border border-border text-xs focus:outline-none focus:ring-2 focus:ring-ring transition-all placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border bg-muted/20">
                <button
                  type="button"
                  onClick={() => setShowChannelModal(false)}
                  disabled={isCreatingChannel}
                  className="h-10 px-4 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingChannel || !newChannelName.trim()}
                  className="h-10 px-5 rounded-xl bg-burgundy hover:bg-burgundy-light text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50 transition-all shadow-md shadow-burgundy/15"
                >
                  {isCreatingChannel ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Oluşturuluyor...</span>
                    </>
                  ) : (
                    <span>Kanal Oluştur</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Poll */}
      {showPollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isCreatingPoll && setShowPollModal(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 z-10">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-sm font-extrabold flex items-center gap-2">
                <Vote className="w-5 h-5 text-burgundy" />
                <span>Yeni Anket Başlat</span>
              </h2>
              <button
                onClick={() => setShowPollModal(false)}
                disabled={isCreatingPoll}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreatePollSubmit}>
              <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
                {/* Question input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Anket Sorusu
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Bu projedeki renk paletini beğendiniz mi?"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    disabled={isCreatingPoll}
                    className="w-full h-11 px-4 rounded-xl bg-input border border-border text-xs focus:outline-none focus:ring-2 focus:ring-ring transition-all placeholder:text-muted-foreground/60"
                  />
                </div>

                {/* Options inputs */}
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Anket Seçenekleri
                    </label>
                    <button
                      type="button"
                      onClick={handleAddPollOptionInput}
                      disabled={isCreatingPoll || pollOptionsInputs.length >= 6}
                      className="text-[10px] font-bold text-burgundy hover:text-burgundy-light flex items-center gap-1 disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Seçenek Ekle</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {pollOptionsInputs.map((optVal, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <span className="w-6 text-[10px] font-mono font-bold text-muted-foreground">{idx + 1}.</span>
                        <input
                          type="text"
                          required={idx < 2}
                          placeholder={`Seçenek ${idx + 1}`}
                          value={optVal}
                          onChange={(e) => handlePollOptionValueChange(idx, e.target.value)}
                          disabled={isCreatingPoll}
                          className="flex-grow h-10 px-3.5 rounded-xl bg-input border border-border text-xs focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                        />
                        {pollOptionsInputs.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePollOptionInput(idx)}
                            disabled={isCreatingPoll}
                            className="p-2 rounded-xl bg-red-950/20 border border-red-900/30 text-red-400 hover:bg-red-950/30 transition-all shrink-0"
                            title="Seçeneği Kaldır"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border bg-muted/20">
                <button
                  type="button"
                  onClick={() => setShowPollModal(false)}
                  disabled={isCreatingPoll}
                  className="h-10 px-4 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingPoll || !pollQuestion.trim()}
                  className="h-10 px-5 rounded-xl bg-burgundy hover:bg-burgundy-light text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50 transition-all shadow-md shadow-burgundy/15"
                >
                  {isCreatingPoll ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Gönderiliyor...</span>
                    </>
                  ) : (
                    <span>Anketi Paylaş</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL 3: Confirm Message Delete */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isDeletingMessage && setShowDeleteModal(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 z-10">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-sm font-extrabold flex items-center gap-2 text-red-500">
                <Trash2 className="w-5 h-5" />
                <span>Mesajı Sil</span>
              </h2>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeletingMessage}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Bu mesajı silmek istediğinizden emin misiniz? Bu işlem kalıcıdır ve geri alınamaz.
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border bg-muted/20">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeletingMessage}
                className="h-10 px-4 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                İptal
              </button>
              <button
                onClick={handleDeleteMessageSubmit}
                disabled={isDeletingMessage}
                className="h-10 px-5 rounded-xl text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50 transition-all shadow-md shadow-red-950/20 cursor-pointer bg-red-600 hover:bg-red-500"
              >
                {isDeletingMessage ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Siliniyor...</span>
                  </>
                ) : (
                  <span>Sil</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
