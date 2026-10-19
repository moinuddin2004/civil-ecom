/* @ds-bundle: {"format":3,"namespace":"DigitalConnectDesignSystem_72e887","components":[],"sourceHashes":{"ui_kits/digital_connect/AppShell.jsx":"fb9d217b717f","ui_kits/digital_connect/ConversationList.jsx":"2fcd8fdb730f","ui_kits/digital_connect/ConversationView.jsx":"9796ed39cb00","ui_kits/digital_connect/Screens.jsx":"f58fa7ac87ed","ui_kits/digital_connect/UserTeamManagement.jsx":"c0ddc04d3f95","ui_kits/digital_connect/primitives.jsx":"d29fa6c473d3"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.DigitalConnectDesignSystem_72e887 = window.DigitalConnectDesignSystem_72e887 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// ui_kits/digital_connect/AppShell.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* global React, Icon, cx */
const {
  useState: useState_SB
} = React;
function Sidebar({
  active,
  onNav,
  collapsed,
  onToggle
}) {
  const items = [{
    key: 'insights',
    label: 'Insights',
    icon: 'home'
  }, {
    key: 'conversations',
    label: 'Conversations',
    icon: 'message'
  }, {
    key: 'templates',
    label: 'Template Manager',
    icon: 'news'
  }, {
    key: 'campaigns',
    label: 'Campaign Manager',
    icon: 'megaphone'
  }, {
    key: 'contacts',
    label: 'Contacts',
    icon: 'users'
  }, {
    key: 'bot',
    label: 'Bot Builder',
    icon: 'bot'
  }, {
    key: 'channels',
    label: 'Channels',
    icon: 'share'
  }, {
    key: 'userMgmt',
    label: 'User Management',
    icon: 'shield'
  }, {
    key: 'team',
    label: 'Teams Management',
    icon: 'users'
  }, {
    key: 'agentChats',
    label: 'Agent Chats',
    icon: 'hash'
  }];
  const footer = [{
    key: 'whatsappManager',
    label: 'WhatsApp Manager',
    icon: 'user'
  }, {
    key: 'billing',
    label: 'Billing',
    icon: 'settings'
  }, {
    key: 'settings',
    label: 'Settings',
    icon: 'settings'
  }, {
    key: 'whatsNew',
    label: "What's New",
    icon: 'bellRing'
  }];
  const width = collapsed ? 64 : 236;
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      width,
      flexShrink: 0,
      height: '100vh',
      background: '#F3F3F3',
      borderRight: '1px solid #E4E7EC',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 200ms ease-out'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 56,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '0 14px',
      borderBottom: '1px solid #E4E7EC'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: collapsed ? '../../assets/logos/collapsedLogo.png' : '../../assets/logos/dcLogo.png',
    style: {
      height: 28,
      width: 'auto'
    }
  }), !collapsed && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontWeight: 800,
      fontSize: 15,
      color: '#363C82',
      letterSpacing: '-0.01em'
    }
  }, "Digital Connect")), /*#__PURE__*/React.createElement("nav", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '8px 8px'
    }
  }, items.map(it => /*#__PURE__*/React.createElement(NavItem, _extends({
    key: it.key
  }, it, {
    active: active === it.key,
    onClick: () => onNav(it.key),
    collapsed: collapsed
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 8px',
      borderTop: '1px solid #E4E7EC'
    }
  }, footer.map(it => /*#__PURE__*/React.createElement(NavItem, _extends({
    key: it.key
  }, it, {
    active: active === it.key,
    onClick: () => onNav(it.key),
    collapsed: collapsed
  })))), /*#__PURE__*/React.createElement("button", {
    onClick: onToggle,
    style: {
      height: 36,
      margin: 8,
      background: '#fff',
      border: '1px solid #E4E7EC',
      borderRadius: 8,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#6B7180'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: collapsed ? 'chevronRight' : 'chevronLeft',
    size: 16
  })));
}
function NavItem({
  label,
  icon,
  active,
  onClick,
  collapsed
}) {
  const [hover, setHover] = useState_SB(false);
  const bg = active ? '#E6F3FF' : hover ? '#EAEBED' : 'transparent';
  const color = active ? '#2781F6' : '#3C3F4A';
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    title: collapsed ? label : undefined,
    style: {
      width: '100%',
      height: 36,
      padding: collapsed ? 0 : '0 10px',
      background: bg,
      color,
      border: 'none',
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      justifyContent: collapsed ? 'center' : 'flex-start',
      fontFamily: 'var(--font-sans)',
      fontSize: 13,
      fontWeight: active ? 700 : 500,
      cursor: 'pointer',
      marginBottom: 2,
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 16
  }), !collapsed && /*#__PURE__*/React.createElement("span", null, label));
}
function TopBar({
  title,
  user,
  status,
  onStatusToggle
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      height: 56,
      borderBottom: '1px solid #E4E7EC',
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-sans)',
      fontSize: 18,
      fontWeight: 700,
      color: '#191A21',
      letterSpacing: '-0.01em'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    onClick: onStatusToggle,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 28,
      padding: '0 10px',
      borderRadius: 9999,
      background: status === 'Available' ? '#DCFCE7' : '#FEF3C7',
      color: status === 'Available' ? '#166534' : '#92400E',
      fontFamily: 'var(--font-sans)',
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: status === 'Available' ? '#16A34A' : '#F59E0B'
    }
  }), status), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: user,
    size: 32
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: '#191A21'
    }
  }, user), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: '#6B7180'
    }
  }, "Agent \xB7 Support Tier 1"))));
}
Object.assign(window, {
  Sidebar,
  TopBar
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/digital_connect/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/digital_connect/ConversationList.jsx
try { (() => {
/* global React, Icon, Avatar, Badge, Input, Button */
const {
  useState: useSt_CL
} = React;
const SEED = [{
  id: 1,
  name: 'Maya Hassan',
  channel: 'whatsapp',
  last: "Thanks! I'll upload the file now.",
  time: '2m',
  unread: 3,
  status: 'ACTIVE'
}, {
  id: 2,
  name: 'Rafi Tariq',
  channel: 'whatsapp',
  last: 'Can you confirm my order #A-2891 status?',
  time: '18m',
  unread: 0,
  status: 'ACTIVE'
}, {
  id: 3,
  name: 'Ayesha Saleem',
  channel: 'messenger',
  last: 'Sent the screenshot of the error.',
  time: '42m',
  unread: 1,
  status: 'QUEUE'
}, {
  id: 4,
  name: 'Kabir Zubair',
  channel: 'instagram',
  last: 'Is the discount still valid?',
  time: '1h',
  unread: 0,
  status: 'ACTIVE'
}, {
  id: 5,
  name: 'Sana Omar',
  channel: 'whatsapp',
  last: 'Perfect, see you tomorrow.',
  time: '3h',
  unread: 0,
  status: 'COMPLETED'
}, {
  id: 6,
  name: 'Danish Yousuf',
  channel: 'messenger',
  last: 'Forwarded to billing team.',
  time: '5h',
  unread: 0,
  status: 'MENTIONED'
}, {
  id: 7,
  name: 'Iqra Malik',
  channel: 'whatsapp',
  last: 'Please try again with the new OTP.',
  time: 'Yesterday',
  unread: 0,
  status: 'COMPLETED'
}];
const FILTERS = ['ALL', 'QUEUE', 'ACTIVE', 'MENTIONED', 'EXPIRED', 'COMPLETED', 'SPAM'];
const FILTER_COLORS = {
  ALL: 'neutral',
  QUEUE: 'blue',
  ACTIVE: 'green',
  MENTIONED: 'purple',
  EXPIRED: 'red',
  COMPLETED: 'cyan',
  SPAM: 'yellow'
};
function ConversationList({
  activeId,
  onSelect
}) {
  const [filter, setFilter] = useSt_CL('ALL');
  const [query, setQuery] = useSt_CL('');
  const list = SEED.filter(c => (filter === 'ALL' || c.status === filter) && (query === '' || c.name.toLowerCase().includes(query.toLowerCase())));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#fff',
      borderRight: '1px solid #E4E7EC'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      borderBottom: '1px solid #F3F4F6',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 16,
      fontWeight: 800,
      color: '#191A21',
      letterSpacing: '-0.01em'
    }
  }, "Conversations"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "soft",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "filter",
      size: 14
    })
  }, "Filter")), /*#__PURE__*/React.createElement(Input, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "search",
      size: 14
    }),
    placeholder: "Search conversations\u2026",
    value: query,
    onChange: e => setQuery(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      overflowX: 'auto',
      paddingBottom: 2
    }
  }, FILTERS.map(f => {
    const isActive = f === filter;
    return /*#__PURE__*/React.createElement("button", {
      key: f,
      onClick: () => setFilter(f),
      style: {
        flexShrink: 0,
        height: 24,
        padding: '0 10px',
        background: isActive ? '#2781F6' : '#F3F4F6',
        color: isActive ? '#fff' : '#3C3F4A',
        border: 'none',
        borderRadius: 9999,
        fontFamily: 'var(--font-sans)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.04em',
        cursor: 'pointer'
      }
    }, f);
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, list.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '40px 20px',
      textAlign: 'center',
      color: '#6B7180'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      marginBottom: 4,
      color: '#191A21'
    }
  }, "No conversations found"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12
    }
  }, "Try adjusting your search terms")) : list.map(c => /*#__PURE__*/React.createElement(Row, {
    key: c.id,
    c: c,
    active: c.id === activeId,
    onClick: () => onSelect(c.id)
  }))));
}
function Row({
  c,
  active,
  onClick
}) {
  const [hover, setHover] = useSt_CL(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      gap: 10,
      padding: '10px 12px',
      borderBottom: '1px solid #F3F4F6',
      cursor: 'pointer',
      background: active ? '#E6F3FF' : hover ? '#F9FAFB' : '#fff',
      borderRight: active ? '2px solid #2781F6' : '2px solid transparent'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: c.name,
    size: 38,
    channel: c.channel
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 6,
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: '#191A21',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, c.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: '#6B7180',
      fontFamily: 'var(--font-mono)',
      flexShrink: 0
    }
  }, c.time)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 6,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: c.unread > 0 ? '#191A21' : '#6B7180',
      fontWeight: c.unread > 0 ? 600 : 400,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, c.last), c.unread > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      background: '#2781F6',
      color: '#fff',
      borderRadius: 9999,
      fontSize: 10,
      fontWeight: 700,
      padding: '1px 7px',
      flexShrink: 0
    }
  }, c.unread)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    variant: FILTER_COLORS[c.status]
  }, c.status))));
}
Object.assign(window, {
  ConversationList,
  SEED
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/digital_connect/ConversationList.jsx", error: String((e && e.message) || e) }); }

// ui_kits/digital_connect/ConversationView.jsx
try { (() => {
/* global React, Icon, Avatar, Button, Badge */
const {
  useState: useSt_CV,
  useRef: useRf_CV,
  useEffect: useEf_CV
} = React;
const BOOT_THREAD = {
  1: [{
    from: 'them',
    text: 'Hi! I want to confirm my order #A-2847.',
    time: '10:41 AM'
  }, {
    from: 'me',
    text: 'Hi Maya! Let me check on that for you.',
    time: '10:42 AM'
  }, {
    from: 'them',
    text: 'I paid via bank transfer this morning.',
    time: '10:43 AM'
  }, {
    from: 'me',
    text: 'Got it — I can see the payment. Could you share the transfer receipt?',
    time: '10:44 AM'
  }, {
    from: 'them',
    text: "Thanks! I'll upload the file now.",
    time: '10:46 AM'
  }],
  2: [{
    from: 'them',
    text: 'Can you confirm my order #A-2891 status?',
    time: '10:24 AM'
  }],
  3: [{
    from: 'them',
    text: 'Sent the screenshot of the error.',
    time: '9:58 AM'
  }],
  4: [{
    from: 'them',
    text: 'Hey — saw your post about the spring sale.',
    time: 'Yesterday'
  }, {
    from: 'them',
    text: 'Is the discount still valid?',
    time: '9:18 AM'
  }],
  5: [{
    from: 'me',
    text: 'Your appointment is confirmed for tomorrow at 2pm.',
    time: '7:40 AM'
  }, {
    from: 'them',
    text: 'Perfect, see you tomorrow.',
    time: '7:45 AM'
  }],
  6: [{
    from: 'me',
    text: 'Forwarded to billing team.',
    time: '5:30 AM'
  }],
  7: [{
    from: 'them',
    text: "I'm not receiving the OTP.",
    time: 'Yesterday'
  }, {
    from: 'me',
    text: 'Please try again with the new OTP.',
    time: 'Yesterday'
  }]
};
function ConversationView({
  contact,
  onSend
}) {
  const [draft, setDraft] = useSt_CV('');
  const [msgs, setMsgs] = useSt_CV(BOOT_THREAD[contact?.id] || []);
  const scrollRef = useRf_CV(null);
  useEf_CV(() => {
    setMsgs(BOOT_THREAD[contact?.id] || []);
  }, [contact?.id]);
  useEf_CV(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);
  const send = () => {
    if (!draft.trim()) return;
    const now = new Date();
    const time = now.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    });
    const next = [...msgs, {
      from: 'me',
      text: draft.trim(),
      time
    }];
    setMsgs(next);
    setDraft('');
    onSend && onSend(contact.id, draft.trim());
  };
  if (!contact) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F8F9FB',
        flexDirection: 'column',
        gap: 8,
        padding: 40,
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: '#E6F3FF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#2781F6'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "message",
      size: 28
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 16,
        fontWeight: 700,
        color: '#191A21'
      }
    }, "Select a conversation"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: '#6B7180'
      }
    }, "Choose a conversation from the list to start messaging"));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: '#F8F9FB',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 60,
      padding: '0 18px',
      borderBottom: '1px solid #E4E7EC',
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: contact.name,
    size: 40,
    channel: contact.channel
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: '#191A21'
    }
  }, contact.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#6B7180',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: '#16A34A'
    }
  }), "Online \xB7 via ", contact.channel)), /*#__PURE__*/React.createElement(Button, {
    size: "icon",
    variant: "soft",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "phone",
      size: 16
    })
  }), /*#__PURE__*/React.createElement(Button, {
    size: "icon",
    variant: "soft",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "more",
      size: 16
    })
  })), /*#__PURE__*/React.createElement("div", {
    ref: scrollRef,
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, msgs.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      justifyContent: m.from === 'me' ? 'flex-end' : 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '70%',
      padding: '8px 12px',
      borderRadius: 12,
      background: m.from === 'me' ? '#2781F6' : '#fff',
      color: m.from === 'me' ? '#fff' : '#191A21',
      border: m.from === 'me' ? 'none' : '1px solid #E4E7EC',
      fontSize: 13,
      lineHeight: 1.5,
      borderBottomRightRadius: m.from === 'me' ? 2 : 12,
      borderBottomLeftRadius: m.from === 'me' ? 12 : 2,
      boxShadow: m.from === 'me' ? 'none' : '0 1px 2px 0 rgb(0 0 0 / 0.04)'
    }
  }, /*#__PURE__*/React.createElement("div", null, m.text), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      marginTop: 4,
      opacity: 0.7,
      textAlign: 'right'
    }
  }, m.time))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      background: '#fff',
      borderTop: '1px solid #E4E7EC'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px solid #C9CCD5',
      borderRadius: 10,
      padding: 10,
      background: '#fff'
    }
  }, /*#__PURE__*/React.createElement("textarea", {
    value: draft,
    onChange: e => setDraft(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    placeholder: "Type a message\u2026",
    style: {
      width: '100%',
      minHeight: 36,
      border: 'none',
      outline: 'none',
      resize: 'none',
      fontFamily: 'var(--font-sans)',
      fontSize: 14,
      color: '#191A21',
      background: 'transparent'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 6,
      borderTop: '1px solid #F3F4F6',
      paddingTop: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "icon",
    variant: "ghost",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "smile",
      size: 16
    })
  }), /*#__PURE__*/React.createElement(Button, {
    size: "icon",
    variant: "ghost",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "paperclip",
      size: 16
    })
  }), /*#__PURE__*/React.createElement(Button, {
    size: "icon",
    variant: "ghost",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "news",
      size: 16
    })
  }), /*#__PURE__*/React.createElement(Button, {
    size: "icon",
    variant: "ghost",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "mic",
      size: 16
    })
  })), /*#__PURE__*/React.createElement(Button, {
    onClick: send,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "send",
      size: 14
    })
  }, "Send")))));
}
Object.assign(window, {
  ConversationView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/digital_connect/ConversationView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/digital_connect/Screens.jsx
try { (() => {
/* global React, Icon */
const {
  useState: useSt_IP
} = React;
function InsightsPage() {
  const kpis = [{
    t: 'Total conversations',
    v: '12,847',
    d: '+8.2%',
    pos: true
  }, {
    t: 'Avg response time',
    v: '2m 14s',
    d: '-12%',
    pos: true
  }, {
    t: 'Messages sent',
    v: '38,291',
    d: '+4.1%',
    pos: true
  }, {
    t: 'CSAT score',
    v: '4.6 / 5',
    d: '-0.1',
    pos: false
  }];
  const bars = [{
    d: 'Mon',
    s: 58,
    r: 44
  }, {
    d: 'Tue',
    s: 72,
    r: 51
  }, {
    d: 'Wed',
    s: 65,
    r: 48
  }, {
    d: 'Thu',
    s: 82,
    r: 63
  }, {
    d: 'Fri',
    s: 90,
    r: 72
  }, {
    d: 'Sat',
    s: 44,
    r: 30
  }, {
    d: 'Sun',
    s: 35,
    r: 22
  }];
  const max = Math.max(...bars.flatMap(b => [b.s, b.r]));
  const chans = [{
    n: 'WhatsApp',
    v: 62,
    c: '#25D366'
  }, {
    n: 'Messenger',
    v: 24,
    c: '#0084FF'
  }, {
    n: 'Instagram',
    v: 11,
    c: '#DC2743'
  }, {
    n: 'Web chat',
    v: 3,
    c: '#6B7180'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 24,
      background: '#F8F9FB',
      overflowY: 'auto',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      color: '#191A21',
      letterSpacing: '-0.015em'
    }
  }, "Insights overview"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: '#6B7180',
      marginTop: 2
    }
  }, "Last 7 days \xB7 all channels")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, ['24h', '7d', '30d', '90d'].map((r, i) => /*#__PURE__*/React.createElement("button", {
    key: r,
    style: {
      height: 30,
      padding: '0 12px',
      borderRadius: 8,
      background: i === 1 ? '#2781F6' : '#fff',
      color: i === 1 ? '#fff' : '#3C3F4A',
      border: i === 1 ? 'none' : '1px solid #C9CCD5',
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, r)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 12,
      marginBottom: 16
    }
  }, kpis.map(k => /*#__PURE__*/React.createElement("div", {
    key: k.t,
    style: {
      background: '#fff',
      border: '1px solid #E4E7EC',
      borderRadius: 10,
      padding: 14,
      boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.04)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#6B7180',
      fontWeight: 600,
      marginBottom: 4
    }
  }, k.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 800,
      color: '#191A21',
      letterSpacing: '-0.01em'
    }
  }, k.v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: k.pos ? '#16A34A' : '#EF4444',
      fontWeight: 600,
      marginTop: 4
    }
  }, k.d, " vs last week")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      border: '1px solid #E4E7EC',
      borderRadius: 10,
      padding: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: '#191A21'
    }
  }, "Conversations by day"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      fontSize: 11,
      color: '#6B7180'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      background: '#2781F6',
      borderRadius: 2
    }
  }), "Sent"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      background: '#16A34A',
      borderRadius: 2
    }
  }), "Replied"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 14,
      height: 180,
      paddingLeft: 6
    }
  }, bars.map(b => /*#__PURE__*/React.createElement("div", {
    key: b.d,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 3,
      alignItems: 'flex-end',
      height: 160
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 12,
      height: `${b.s / max * 100}%`,
      background: '#2781F6',
      borderRadius: '3px 3px 0 0'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 12,
      height: `${b.r / max * 100}%`,
      background: '#16A34A',
      borderRadius: '3px 3px 0 0'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: '#6B7180',
      fontWeight: 600
    }
  }, b.d))))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      border: '1px solid #E4E7EC',
      borderRadius: 10,
      padding: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: '#191A21',
      marginBottom: 14
    }
  }, "By channel"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, chans.map(ch => /*#__PURE__*/React.createElement("div", {
    key: ch.n
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 12,
      marginBottom: 4,
      color: '#3C3F4A'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600
    }
  }, ch.n), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)'
    }
  }, ch.v, "%")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8,
      borderRadius: 4,
      background: '#F3F4F6',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${ch.v}%`,
      height: '100%',
      background: ch.c,
      borderRadius: 4
    }
  }))))))));
}
function LoginPage({
  onLogin
}) {
  const [email, setEmail] = useSt_IP('agent@digiconn.co');
  const [pw, setPw] = useSt_IP('••••••••');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F8F9FB',
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 380,
      background: '#fff',
      border: '1px solid #E4E7EC',
      borderRadius: 12,
      padding: 28,
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logos/dcLogo.png",
    style: {
      height: 42,
      width: 'auto',
      marginBottom: 14
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 800,
      color: '#191A21',
      letterSpacing: '-0.015em'
    }
  }, "Sign in to your account"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: '#6B7180',
      marginTop: 4,
      marginBottom: 20
    }
  }, "Welcome back to Digital Connect."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      fontWeight: 600,
      color: '#3C3F4A',
      marginBottom: 6
    }
  }, "Email"), /*#__PURE__*/React.createElement("input", {
    value: email,
    onChange: e => setEmail(e.target.value),
    style: {
      width: '100%',
      height: 38,
      padding: '0 12px',
      border: '1px solid #C9CCD5',
      borderRadius: 8,
      fontSize: 14,
      outline: 'none'
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 12,
      fontWeight: 600,
      color: '#3C3F4A',
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", null, "Password"), /*#__PURE__*/React.createElement("a", {
    style: {
      color: '#2781F6',
      textDecoration: 'none',
      fontWeight: 600
    }
  }, "Forgot your password?")), /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: pw,
    onChange: e => setPw(e.target.value),
    style: {
      width: '100%',
      height: 38,
      padding: '0 12px',
      border: '1px solid #C9CCD5',
      borderRadius: 8,
      fontSize: 14,
      outline: 'none'
    }
  })), /*#__PURE__*/React.createElement("button", {
    onClick: onLogin,
    style: {
      height: 40,
      background: '#2781F6',
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      fontWeight: 700,
      fontSize: 14,
      cursor: 'pointer',
      marginTop: 4
    }
  }, "Sign in")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      fontSize: 11,
      color: '#6B7180',
      textAlign: 'center'
    }
  }, "\xA9 EOcean Private Limited. ", /*#__PURE__*/React.createElement("a", {
    style: {
      color: '#2781F6'
    }
  }, "Privacy policy"), " \xB7 ", /*#__PURE__*/React.createElement("a", {
    style: {
      color: '#2781F6'
    }
  }, "Terms of Service"))));
}
function TemplatesPage() {
  const tmpls = [{
    t: 'Order Confirmation',
    cat: 'Transactional',
    lang: 'English',
    status: 'APPROVED',
    color: 'green',
    preview: 'Hi {{1}}, your order #{{2}} has been confirmed and will ship by {{3}}.'
  }, {
    t: 'Abandoned Cart',
    cat: 'Marketing',
    lang: 'English',
    status: 'APPROVED',
    color: 'green',
    preview: 'Still thinking it over? Your cart is waiting — complete checkout to get 10% off.'
  }, {
    t: 'Appointment Reminder',
    cat: 'Utility',
    lang: 'English',
    status: 'APPROVED',
    color: 'green',
    preview: "Hi {{1}}, reminder: you have an appointment tomorrow at {{2}}."
  }, {
    t: 'Delivery Update',
    cat: 'Transactional',
    lang: 'Arabic',
    status: 'PENDING',
    color: 'yellow',
    preview: 'تم شحن طلبك بنجاح. تتبع الشحنة هنا: {{1}}'
  }, {
    t: 'Payment Failed',
    cat: 'Utility',
    lang: 'English',
    status: 'APPROVED',
    color: 'green',
    preview: 'Hi {{1}}, we couldn\'t process your payment. Please update your method at {{2}}.'
  }, {
    t: 'Black Friday Promo',
    cat: 'Marketing',
    lang: 'English',
    status: 'REJECTED',
    color: 'red',
    preview: 'Massive Black Friday sale — up to 60% off everything.'
  }];
  const statusStyles = {
    green: {
      bg: '#DCFCE7',
      fg: '#166534'
    },
    yellow: {
      bg: '#FEF3C7',
      fg: '#92400E'
    },
    red: {
      bg: '#FEE2E2',
      fg: '#991B1B'
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 24,
      background: '#F8F9FB',
      overflowY: 'auto',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      color: '#191A21',
      letterSpacing: '-0.015em'
    }
  }, "Template Manager"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: '#6B7180',
      marginTop: 2
    }
  }, "Reusable WhatsApp Business message templates")), /*#__PURE__*/React.createElement("button", {
    style: {
      height: 36,
      padding: '0 14px',
      background: '#2781F6',
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 700,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 14
  }), "Create Template")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 0,
      borderBottom: '1px solid #C9CCD5',
      marginBottom: 16
    }
  }, ['Overview', 'Create Template', 'Explore Templates'].map((t, i) => /*#__PURE__*/React.createElement("button", {
    key: t,
    style: {
      height: 36,
      padding: '0 14px',
      background: 'transparent',
      border: 'none',
      borderBottom: i === 0 ? '2px solid #2781F6' : '2px solid transparent',
      color: i === 0 ? '#2781F6' : '#6B7180',
      fontWeight: 600,
      fontSize: 13,
      cursor: 'pointer'
    }
  }, t))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 12
    }
  }, tmpls.map(t => {
    const s = statusStyles[t.color];
    return /*#__PURE__*/React.createElement("div", {
      key: t.t,
      style: {
        background: '#fff',
        border: '1px solid #E4E7EC',
        borderRadius: 10,
        padding: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 700,
        color: '#191A21'
      }
    }, t.t), /*#__PURE__*/React.createElement("span", {
      style: {
        height: 20,
        padding: '0 8px',
        background: s.bg,
        color: s.fg,
        borderRadius: 9999,
        fontSize: 10,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center'
      }
    }, t.status)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: '#6B7180',
        fontWeight: 600
      }
    }, t.cat), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: '#6B7180'
      }
    }, "\xB7"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: '#6B7180',
        fontWeight: 600
      }
    }, t.lang)), /*#__PURE__*/React.createElement("div", {
      style: {
        background: '#F8F9FB',
        border: '1px solid #F3F4F6',
        borderRadius: 8,
        padding: 10,
        fontSize: 12,
        color: '#3C3F4A',
        lineHeight: 1.55,
        minHeight: 64
      }
    }, t.preview), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        marginTop: 10
      }
    }, /*#__PURE__*/React.createElement("button", {
      style: {
        flex: 1,
        height: 28,
        background: '#F3F4F6',
        border: 'none',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        color: '#3C3F4A',
        cursor: 'pointer'
      }
    }, "Preview"), /*#__PURE__*/React.createElement("button", {
      style: {
        flex: 1,
        height: 28,
        background: '#E6F3FF',
        color: '#1D4ED8',
        border: 'none',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer'
      }
    }, "Use")));
  })));
}
Object.assign(window, {
  InsightsPage,
  LoginPage,
  TemplatesPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/digital_connect/Screens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/digital_connect/UserTeamManagement.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* global React, Icon, Avatar, Button, Badge, Input */
const {
  useState: useSt_UM
} = React;

// ============================================================================
// Shared atoms
// ============================================================================

function Modal({
  open,
  onClose,
  title,
  description,
  width = 520,
  children,
  footer
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      background: 'rgba(17,24,39,0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      animation: 'dcfade 150ms ease-out'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: '100%',
      maxWidth: width,
      maxHeight: '85vh',
      background: '#fff',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 20px 40px -10px rgb(0 0 0 / 0.25), 0 8px 16px -4px rgb(0 0 0 / 0.12)',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 24px',
      borderBottom: '1px solid #E4E7EC',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: '#191A21'
    }
  }, title), description && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: '#6B7180',
      marginTop: 4
    }
  }, description)), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: 28,
      height: 28,
      background: 'transparent',
      border: 'none',
      borderRadius: 6,
      cursor: 'pointer',
      color: '#6B7180',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    onMouseEnter: e => e.currentTarget.style.background = '#F3F4F6',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 24px',
      overflowY: 'auto',
      flex: 1
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 24px',
      borderTop: '1px solid #E4E7EC',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 8,
      background: '#FAFBFC'
    }
  }, footer)));
}
function Field({
  label,
  required,
  children,
  colSpan
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      gridColumn: colSpan ? `span ${colSpan}` : undefined
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: '#3C3F4A'
    }
  }, label, required && /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#EF4444',
      marginLeft: 2
    }
  }, "*")), children);
}
function TextInput({
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("input", _extends({}, rest, {
    style: {
      height: 36,
      padding: '0 12px',
      border: '1px solid #C9CCD5',
      borderRadius: 8,
      fontSize: 14,
      color: '#191A21',
      outline: 'none',
      background: '#fff',
      fontFamily: 'var(--font-sans)',
      ...style
    },
    onFocus: e => {
      e.currentTarget.style.borderColor = '#2781F6';
      e.currentTarget.style.boxShadow = '0 0 0 1px #2781F6';
    },
    onBlur: e => {
      e.currentTarget.style.borderColor = '#C9CCD5';
      e.currentTarget.style.boxShadow = 'none';
    }
  }));
}
function SelectInput({
  value,
  onChange,
  options,
  placeholder
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: value,
    onChange: e => onChange(e.target.value),
    style: {
      width: '100%',
      height: 36,
      padding: '0 32px 0 12px',
      border: '1px solid #C9CCD5',
      borderRadius: 8,
      fontSize: 14,
      color: value ? '#191A21' : '#6B7180',
      outline: 'none',
      background: '#fff',
      fontFamily: 'var(--font-sans)',
      appearance: 'none'
    }
  }, placeholder && /*#__PURE__*/React.createElement("option", {
    value: ""
  }, placeholder), options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))), /*#__PURE__*/React.createElement(Icon, {
    name: "chevronDown",
    size: 14,
    style: {
      position: 'absolute',
      right: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#6B7180',
      pointerEvents: 'none'
    }
  }));
}
function Switch({
  checked,
  onChange
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: () => onChange(!checked),
    style: {
      width: 34,
      height: 20,
      borderRadius: 9999,
      background: checked ? '#2781F6' : '#C9CCD5',
      border: 'none',
      position: 'relative',
      cursor: 'pointer',
      transition: 'background 150ms'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 2,
      left: checked ? 16 : 2,
      width: 16,
      height: 16,
      borderRadius: '50%',
      background: '#fff',
      transition: 'left 150ms',
      boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.1)'
    }
  }));
}
function Checkbox({
  checked,
  onChange
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: () => onChange(!checked),
    style: {
      width: 16,
      height: 16,
      borderRadius: 4,
      background: checked ? '#2781F6' : '#fff',
      border: checked ? '1px solid #2781F6' : '1.5px solid #C9CCD5',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      flexShrink: 0
    }
  }, checked && /*#__PURE__*/React.createElement("svg", {
    width: "10",
    height: "10",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "3",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  })));
}
function StatusPill({
  status
}) {
  const styles = {
    Active: {
      bg: '#DCFCE7',
      fg: '#15803D',
      border: '#BBF7D0'
    },
    Inactive: {
      bg: '#FEE2E2',
      fg: '#991B1B',
      border: '#FECACA'
    },
    Pending: {
      bg: '#FEF3C7',
      fg: '#92400E',
      border: '#FDE68A'
    }
  };
  const s = styles[status] || styles.Inactive;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      height: 22,
      padding: '0 10px',
      background: s.bg,
      color: s.fg,
      border: `1px solid ${s.border}`,
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600
    }
  }, status);
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

const INITIAL_USERS = [{
  UserName: 'Daniyal Tariq',
  Role: 'Admin',
  status: 'Active',
  Email: 'daniyal@digiconn.co',
  Number: '+92 333 2222452',
  updatedOn: '2021-09-01'
}, {
  UserName: 'Haziq Ahmed',
  Role: 'Agent',
  status: 'Inactive',
  Email: 'haziq@digiconn.co',
  Number: '+92 332 5522352',
  updatedOn: '2021-09-01'
}, {
  UserName: 'Waiz Bin Qasim',
  Role: 'Agent',
  status: 'Active',
  Email: 'waiz@digiconn.co',
  Number: '+92 334 2622452',
  updatedOn: '2021-09-01'
}, {
  UserName: 'Tanzeel Khan',
  Role: 'Agent',
  status: 'Active',
  Email: 'tanzeel@digiconn.co',
  Number: '+92 333 2892165',
  updatedOn: '2021-09-01'
}, {
  UserName: 'Anam Siddiqui',
  Role: 'Supervisor',
  status: 'Active',
  Email: 'anam@digiconn.co',
  Number: '+92 333 2249509',
  updatedOn: '2021-09-01'
}, {
  UserName: 'Zaid Hussain',
  Role: 'Marketer',
  status: 'Active',
  Email: 'zaid@digiconn.co',
  Number: '+92 321 4456712',
  updatedOn: '2021-09-02'
}, {
  UserName: 'Sana Omar',
  Role: 'Agent',
  status: 'Active',
  Email: 'sana@digiconn.co',
  Number: '+92 345 1123456',
  updatedOn: '2021-09-03'
}, {
  UserName: 'Rafi Tariq',
  Role: 'Agent',
  status: 'Inactive',
  Email: 'rafi@digiconn.co',
  Number: '+92 300 6789012',
  updatedOn: '2021-09-04'
}];
const ROLE_OPTIONS = [{
  value: 'admin',
  label: 'Admin'
}, {
  value: 'agent',
  label: 'Agent'
}, {
  value: 'supervisor',
  label: 'Supervisor'
}, {
  value: 'marketer',
  label: 'Marketer'
}];
function UsersPage() {
  const [rows, setRows] = useSt_UM(INITIAL_USERS);
  const [query, setQuery] = useSt_UM('');
  const [roleFilter, setRoleFilter] = useSt_UM('');
  const [statusFilter, setStatusFilter] = useSt_UM('');
  const [sort, setSort] = useSt_UM({
    key: 'UserName',
    dir: 'asc'
  });
  const [selected, setSelected] = useSt_UM(new Set());
  const [createOpen, setCreateOpen] = useSt_UM(false);
  const [deleteTarget, setDeleteTarget] = useSt_UM(null);
  const filtered = rows.filter(u => (query === '' || u.UserName.toLowerCase().includes(query.toLowerCase()) || u.Email.toLowerCase().includes(query.toLowerCase())) && (roleFilter === '' || u.Role === roleFilter) && (statusFilter === '' || u.status === statusFilter)).sort((a, b) => {
    const av = a[sort.key],
      bv = b[sort.key];
    if (av < bv) return sort.dir === 'asc' ? -1 : 1;
    if (av > bv) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });
  const toggleSort = key => {
    setSort(s => s.key === key ? {
      key,
      dir: s.dir === 'asc' ? 'desc' : 'asc'
    } : {
      key,
      dir: 'asc'
    });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());else setSelected(new Set(filtered.map(r => r.UserName)));
  };
  const toggleOne = name => {
    const next = new Set(selected);
    next.has(name) ? next.delete(name) : next.add(name);
    setSelected(next);
  };
  const addUser = u => {
    setRows(prev => [{
      UserName: `${u.firstName} ${u.lastName}`.trim(),
      Email: u.email,
      Number: u.mobileNo,
      Role: u.role,
      status: 'Active',
      updatedOn: new Date().toISOString().slice(0, 10)
    }, ...prev]);
  };
  const deleteUser = () => {
    if (!deleteTarget) return;
    setRows(prev => prev.filter(r => r.UserName !== deleteTarget));
    setDeleteTarget(null);
  };
  const stats = [{
    t: 'Total users',
    v: rows.length,
    c: '#2781F6'
  }, {
    t: 'Active',
    v: rows.filter(r => r.status === 'Active').length,
    c: '#16A34A'
  }, {
    t: 'Admins',
    v: rows.filter(r => r.Role === 'Admin').length,
    c: '#363C82'
  }, {
    t: 'Agents',
    v: rows.filter(r => r.Role === 'Agent').length,
    c: '#F59E0B'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 24,
      background: '#F8F9FB',
      overflowY: 'auto',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      color: '#191A21',
      letterSpacing: '-0.015em'
    }
  }, "User Management"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: '#6B7180',
      marginTop: 2
    }
  }, "Add, edit, and manage agent accounts across your workspace")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 14
    }),
    onClick: () => setCreateOpen(true)
  }, "Create User")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 12,
      marginBottom: 16
    }
  }, stats.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.t,
    style: {
      background: '#fff',
      border: '1px solid #E4E7EC',
      borderRadius: 10,
      padding: '12px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#6B7180',
      fontWeight: 600
    }
  }, s.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      color: s.c,
      letterSpacing: '-0.01em',
      marginTop: 2
    }
  }, s.v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      border: '1px solid #E4E7EC',
      borderRadius: 10,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      borderBottom: '1px solid #F3F4F6',
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 260
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 14,
    style: {
      position: 'absolute',
      left: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#6B7180'
    }
  }), /*#__PURE__*/React.createElement(TextInput, {
    placeholder: "Search by name or email\u2026",
    value: query,
    onChange: e => setQuery(e.target.value),
    style: {
      width: '100%',
      paddingLeft: 34
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 150
    }
  }, /*#__PURE__*/React.createElement(SelectInput, {
    value: roleFilter,
    onChange: setRoleFilter,
    placeholder: "All roles",
    options: ROLE_OPTIONS.map(o => ({
      value: o.label,
      label: o.label
    }))
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 140
    }
  }, /*#__PURE__*/React.createElement(SelectInput, {
    value: statusFilter,
    onChange: setStatusFilter,
    placeholder: "All statuses",
    options: [{
      value: 'Active',
      label: 'Active'
    }, {
      value: 'Inactive',
      label: 'Inactive'
    }]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), selected.size > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: '#6B7180'
    }
  }, selected.size, " selected"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary"
  }, "Deactivate"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "destructive"
  }, "Delete"))), /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: 'auto'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: '#F8F9FB',
      borderBottom: '1px solid #E4E7EC'
    }
  }, /*#__PURE__*/React.createElement("th", {
    style: {
      padding: '10px 14px',
      textAlign: 'left',
      width: 36
    }
  }, /*#__PURE__*/React.createElement(Checkbox, {
    checked: filtered.length > 0 && selected.size === filtered.length,
    onChange: toggleAll
  })), [['UserName', 'Name', true], ['Email', 'Email', false], ['Number', 'Number', false], ['Role', 'Role', true], ['status', 'Status', true], ['updatedOn', 'Created On', true]].map(([k, l, sortable]) => /*#__PURE__*/React.createElement("th", {
    key: k,
    style: {
      padding: '10px 14px',
      textAlign: 'left',
      fontSize: 11,
      fontWeight: 700,
      color: '#6B7180',
      letterSpacing: '0.02em',
      textTransform: 'uppercase',
      borderRight: '1px solid #E4E7EC'
    }
  }, sortable ? /*#__PURE__*/React.createElement("button", {
    onClick: () => toggleSort(k),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      background: 'transparent',
      border: 'none',
      color: '#6B7180',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.02em',
      textTransform: 'uppercase',
      cursor: 'pointer',
      padding: 0
    }
  }, l, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      opacity: sort.key === k ? 1 : 0.4
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M7 15l5 5 5-5M7 9l5-5 5 5"
  }))) : l)), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: '10px 14px',
      textAlign: 'left',
      fontSize: 11,
      fontWeight: 700,
      color: '#6B7180',
      letterSpacing: '0.02em',
      textTransform: 'uppercase'
    }
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", null, filtered.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 8,
    style: {
      padding: '48px 14px',
      textAlign: 'center',
      color: '#6B7180'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: '#191A21',
      marginBottom: 4
    }
  }, "No users found"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12
    }
  }, "Try adjusting your search or filters"))) : filtered.map((u, i) => {
    const isSelected = selected.has(u.UserName);
    return /*#__PURE__*/React.createElement("tr", {
      key: u.UserName,
      style: {
        borderBottom: i === filtered.length - 1 ? 'none' : '1px solid #F3F4F6',
        background: isSelected ? '#F0F7FF' : '#fff'
      }
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '10px 14px'
      }
    }, /*#__PURE__*/React.createElement(Checkbox, {
      checked: isSelected,
      onChange: () => toggleOne(u.UserName)
    })), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '10px 14px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: u.UserName,
      size: 32
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600,
        color: '#191A21'
      }
    }, u.UserName))), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '10px 14px',
        color: '#3C3F4A'
      }
    }, u.Email), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '10px 14px',
        color: '#3C3F4A',
        fontFamily: 'var(--font-mono)',
        fontSize: 12
      }
    }, u.Number), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '10px 14px'
      }
    }, /*#__PURE__*/React.createElement(RolePill, {
      role: u.Role
    })), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '10px 14px'
      }
    }, /*#__PURE__*/React.createElement(StatusPill, {
      status: u.status
    })), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '10px 14px',
        color: '#6B7180',
        fontFamily: 'var(--font-mono)',
        fontSize: 12
      }
    }, u.updatedOn), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '10px 14px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 2
      }
    }, /*#__PURE__*/React.createElement(IconBtn, {
      title: "Edit"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "brand",
      size: 14
    })), /*#__PURE__*/React.createElement(IconBtn, {
      title: "Edit"
    }, /*#__PURE__*/React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M12 20h9"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
    }))), /*#__PURE__*/React.createElement(IconBtn, {
      title: "Delete",
      onClick: () => setDeleteTarget(u.UserName)
    }, /*#__PURE__*/React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("polyline", {
      points: "3 6 5 6 21 6"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
    }))))));
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 14px',
      borderTop: '1px solid #F3F4F6',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: 12,
      color: '#6B7180'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Showing ", /*#__PURE__*/React.createElement("strong", null, "1"), "\u2013", /*#__PURE__*/React.createElement("strong", null, filtered.length), " of ", /*#__PURE__*/React.createElement("strong", null, rows.length), " users"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chevronLeft",
      size: 12
    })
  }), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "primary"
  }, "1"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary"
  }, "2"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chevronRight",
      size: 12
    })
  })))), /*#__PURE__*/React.createElement(CreateUserModal, {
    open: createOpen,
    onClose: () => setCreateOpen(false),
    onCreate: addUser
  }), /*#__PURE__*/React.createElement(ConfirmDialog, {
    open: !!deleteTarget,
    onClose: () => setDeleteTarget(null),
    title: "Are you sure?",
    description: `This action cannot be undone. This will permanently delete ${deleteTarget}.`,
    confirmLabel: "Continue",
    onConfirm: deleteUser
  }));
}
function RolePill({
  role
}) {
  const styles = {
    Admin: {
      bg: '#EDE9FE',
      fg: '#5B21B6'
    },
    Supervisor: {
      bg: '#DBEAFE',
      fg: '#1E40AF'
    },
    Agent: {
      bg: '#E0F2FE',
      fg: '#075985'
    },
    Marketer: {
      bg: '#FCE7F3',
      fg: '#9D174D'
    }
  };
  const s = styles[role] || {
    bg: '#F3F4F6',
    fg: '#3C3F4A'
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      height: 22,
      padding: '0 10px',
      background: s.bg,
      color: s.fg,
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600
    }
  }, role);
}
function IconBtn({
  children,
  onClick,
  title
}) {
  const [hover, setHover] = useSt_UM(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    title: title,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      width: 28,
      height: 28,
      background: hover ? '#F3F4F6' : 'transparent',
      border: 'none',
      borderRadius: 6,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#3C3F4A'
    }
  }, children);
}
function CreateUserModal({
  open,
  onClose,
  onCreate
}) {
  const [f, setF] = useSt_UM({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    role: '',
    mobileNo: ''
  });
  const upd = (k, v) => setF(p => ({
    ...p,
    [k]: v
  }));
  const submit = () => {
    if (!f.firstName || !f.lastName || !f.email || !f.role) return;
    onCreate({
      ...f,
      role: ROLE_OPTIONS.find(o => o.value === f.role)?.label || f.role
    });
    setF({
      firstName: '',
      lastName: '',
      username: '',
      email: '',
      role: '',
      mobileNo: ''
    });
    onClose();
  };
  return /*#__PURE__*/React.createElement(Modal, {
    open: open,
    onClose: onClose,
    title: "Create User",
    description: "Add a new team member to your workspace.",
    width: 520,
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      onClick: onClose
    }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
      onClick: submit
    }, "Create"))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "First Name",
    required: true
  }, /*#__PURE__*/React.createElement(TextInput, {
    placeholder: "John",
    value: f.firstName,
    onChange: e => upd('firstName', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Last Name",
    required: true
  }, /*#__PURE__*/React.createElement(TextInput, {
    placeholder: "Doe",
    value: f.lastName,
    onChange: e => upd('lastName', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Username",
    colSpan: 2
  }, /*#__PURE__*/React.createElement(TextInput, {
    placeholder: "john.doe",
    value: f.username,
    onChange: e => upd('username', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Email",
    required: true,
    colSpan: 2
  }, /*#__PURE__*/React.createElement(TextInput, {
    type: "email",
    placeholder: "john.doe@xyz.com",
    value: f.email,
    onChange: e => upd('email', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Role",
    required: true,
    colSpan: 2
  }, /*#__PURE__*/React.createElement(SelectInput, {
    value: f.role,
    onChange: v => upd('role', v),
    placeholder: "Select a role\u2026",
    options: ROLE_OPTIONS
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Mobile Number",
    colSpan: 2
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 36,
      padding: '0 10px',
      border: '1px solid #C9CCD5',
      borderRadius: 8,
      background: '#fff',
      fontSize: 14,
      color: '#191A21'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16
    }
  }, "\uD83C\uDDF5\uD83C\uDDF0"), /*#__PURE__*/React.createElement("span", null, "+92")), /*#__PURE__*/React.createElement(TextInput, {
    placeholder: "3xxxxxxxx",
    value: f.mobileNo,
    onChange: e => upd('mobileNo', e.target.value),
    style: {
      flex: 1
    }
  })))));
}
function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = 'Continue',
  onConfirm
}) {
  return /*#__PURE__*/React.createElement(Modal, {
    open: open,
    onClose: onClose,
    title: title,
    description: description,
    width: 420,
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      onClick: onClose
    }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
      variant: "destructive",
      onClick: onConfirm
    }, confirmLabel))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: '50%',
      background: '#FEE2E2',
      color: '#991B1B',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "9",
    x2: "12",
    y2: "13"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "17",
    x2: "12.01",
    y2: "17"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: '#3C3F4A',
      lineHeight: 1.55
    }
  }, "This is a destructive action. Please confirm you want to proceed.")));
}

// ============================================================================
// TEAM MANAGEMENT
// ============================================================================

const INITIAL_TEAMS = [{
  TeamName: 'Customer Support',
  TeamSupervisor: 'John Doe',
  status: 'Active',
  AgentsCount: 12,
  channels: ['WhatsApp', 'Messenger', 'WebChat'],
  updatedOn: '2021-09-01'
}, {
  TeamName: 'Technical Support',
  TeamSupervisor: 'Jane Smith',
  status: 'Active',
  AgentsCount: 8,
  channels: ['WhatsApp', 'WebChat'],
  updatedOn: '2021-09-02'
}, {
  TeamName: 'Sales Team',
  TeamSupervisor: 'Robert Johnson',
  status: 'Inactive',
  AgentsCount: 5,
  channels: ['Instagram', 'Messenger'],
  updatedOn: '2021-09-03'
}, {
  TeamName: 'Marketing',
  TeamSupervisor: 'Emily Davis',
  status: 'Active',
  AgentsCount: 7,
  channels: ['Instagram', 'WhatsApp'],
  updatedOn: '2021-09-04'
}, {
  TeamName: 'Product Development',
  TeamSupervisor: 'Michael Wilson',
  status: 'Active',
  AgentsCount: 15,
  channels: ['WhatsApp', 'Messenger', 'Mobile SDK'],
  updatedOn: '2021-09-05'
}, {
  TeamName: 'Quality Assurance',
  TeamSupervisor: 'Sarah Brown',
  status: 'Inactive',
  AgentsCount: 6,
  channels: ['WebChat'],
  updatedOn: '2021-09-06'
}, {
  TeamName: 'Human Resources',
  TeamSupervisor: 'David Miller',
  status: 'Active',
  AgentsCount: 4,
  channels: ['WhatsApp'],
  updatedOn: '2021-09-07'
}, {
  TeamName: 'Finance',
  TeamSupervisor: 'Jennifer Taylor',
  status: 'Active',
  AgentsCount: 5,
  channels: ['WhatsApp', 'WebChat'],
  updatedOn: '2021-09-08'
}];
const AVAILABLE_AGENTS = ['Zaid', 'Daniyal', 'Tanzeel', 'Haziq', 'Waiz', 'Anam', 'Sana', 'Rafi', 'Maya', 'Kabir'];
const CHANNELS = ['WhatsApp', 'Messenger', 'Instagram', 'WebChat', 'Mobile SDK'];
const CHANNEL_COLORS = {
  WhatsApp: '#25D366',
  Messenger: '#0084FF',
  Instagram: '#DC2743',
  WebChat: '#6B7180',
  'Mobile SDK': '#363C82'
};
function TeamsPage() {
  const [rows, setRows] = useSt_UM(INITIAL_TEAMS);
  const [query, setQuery] = useSt_UM('');
  const [statusFilter, setStatusFilter] = useSt_UM('');
  const [createOpen, setCreateOpen] = useSt_UM(false);
  const [deleteTarget, setDeleteTarget] = useSt_UM(null);
  const filtered = rows.filter(t => (query === '' || t.TeamName.toLowerCase().includes(query.toLowerCase()) || t.TeamSupervisor.toLowerCase().includes(query.toLowerCase())) && (statusFilter === '' || t.status === statusFilter));
  const addTeam = t => {
    setRows(prev => [{
      TeamName: t.teamName,
      TeamSupervisor: t.supervisor,
      status: 'Active',
      AgentsCount: t.agents.length,
      channels: t.channels,
      updatedOn: new Date().toISOString().slice(0, 10)
    }, ...prev]);
  };
  const deleteTeam = () => {
    if (!deleteTarget) return;
    setRows(prev => prev.filter(r => r.TeamName !== deleteTarget));
    setDeleteTarget(null);
  };
  const stats = [{
    t: 'Total teams',
    v: rows.length,
    c: '#2781F6'
  }, {
    t: 'Active teams',
    v: rows.filter(r => r.status === 'Active').length,
    c: '#16A34A'
  }, {
    t: 'Total agents',
    v: rows.reduce((s, r) => s + r.AgentsCount, 0),
    c: '#363C82'
  }, {
    t: 'Supervisors',
    v: new Set(rows.map(r => r.TeamSupervisor)).size,
    c: '#F59E0B'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 24,
      background: '#F8F9FB',
      overflowY: 'auto',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      color: '#191A21',
      letterSpacing: '-0.015em'
    }
  }, "Teams Management"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: '#6B7180',
      marginTop: 2
    }
  }, "Group agents into teams and assign channels")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 14
    }),
    onClick: () => setCreateOpen(true)
  }, "Create Team")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 12,
      marginBottom: 16
    }
  }, stats.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.t,
    style: {
      background: '#fff',
      border: '1px solid #E4E7EC',
      borderRadius: 10,
      padding: '12px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#6B7180',
      fontWeight: 600
    }
  }, s.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      color: s.c,
      letterSpacing: '-0.01em',
      marginTop: 2
    }
  }, s.v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      border: '1px solid #E4E7EC',
      borderRadius: 10,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      borderBottom: '1px solid #F3F4F6',
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 280
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 14,
    style: {
      position: 'absolute',
      left: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#6B7180'
    }
  }), /*#__PURE__*/React.createElement(TextInput, {
    placeholder: "Search teams or supervisors\u2026",
    value: query,
    onChange: e => setQuery(e.target.value),
    style: {
      width: '100%',
      paddingLeft: 34
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 140
    }
  }, /*#__PURE__*/React.createElement(SelectInput, {
    value: statusFilter,
    onChange: setStatusFilter,
    placeholder: "All statuses",
    options: [{
      value: 'Active',
      label: 'Active'
    }, {
      value: 'Inactive',
      label: 'Inactive'
    }]
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: 12,
      padding: 14
    }
  }, filtered.map(t => /*#__PURE__*/React.createElement(TeamCard, {
    key: t.TeamName,
    team: t,
    onDelete: () => setDeleteTarget(t.TeamName)
  })), filtered.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: '1 / -1',
      padding: '48px 14px',
      textAlign: 'center',
      color: '#6B7180'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: '#191A21',
      marginBottom: 4
    }
  }, "No teams found"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12
    }
  }, "Try adjusting your search or filters")))), /*#__PURE__*/React.createElement(CreateTeamModal, {
    open: createOpen,
    onClose: () => setCreateOpen(false),
    onCreate: addTeam
  }), /*#__PURE__*/React.createElement(ConfirmDialog, {
    open: !!deleteTarget,
    onClose: () => setDeleteTarget(null),
    title: "Are you sure?",
    description: `This action cannot be undone. This will permanently delete team "${deleteTarget}".`,
    confirmLabel: "Delete",
    onConfirm: deleteTeam
  }));
}
function TeamCard({
  team,
  onDelete
}) {
  const [hover, setHover] = useSt_UM(false);
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      background: '#fff',
      border: '1px solid #E4E7EC',
      borderRadius: 10,
      padding: 16,
      transition: 'border-color 150ms, box-shadow 150ms',
      borderColor: hover ? '#C9CCD5' : '#E4E7EC',
      boxShadow: hover ? '0 4px 6px -1px rgb(0 0 0 / 0.05)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: '#191A21'
    }
  }, team.TeamName), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#6B7180',
      marginTop: 2
    }
  }, "Supervised by ", team.TeamSupervisor)), /*#__PURE__*/React.createElement(StatusPill, {
    status: team.status
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '10px 0',
      borderTop: '1px solid #F3F4F6',
      borderBottom: '1px solid #F3F4F6',
      margin: '10px 0'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: '#6B7180',
      fontWeight: 600
    }
  }, "AGENTS"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 800,
      color: '#191A21'
    }
  }, team.AgentsCount)), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 28,
      background: '#E4E7EC'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: '#6B7180',
      fontWeight: 600,
      marginBottom: 4
    }
  }, "CHANNELS"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      flexWrap: 'wrap'
    }
  }, team.channels.map(c => /*#__PURE__*/React.createElement("span", {
    key: c,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      height: 20,
      padding: '0 8px',
      borderRadius: 9999,
      background: '#F3F4F6',
      color: '#3C3F4A',
      fontSize: 10,
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: CHANNEL_COLORS[c] || '#6B7180'
    }
  }), c))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: '#6B7180',
      fontFamily: 'var(--font-mono)'
    }
  }, "Updated ", team.updatedOn), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "soft"
  }, "View"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary",
    onClick: onDelete
  }, "Delete"))));
}
function CreateTeamModal({
  open,
  onClose,
  onCreate
}) {
  const [teamName, setTeamName] = useSt_UM('');
  const [supervisor, setSupervisor] = useSt_UM('');
  const [selectedAgents, setSelectedAgents] = useSt_UM([]);
  const [agentQuery, setAgentQuery] = useSt_UM('');
  const [channels, setChannels] = useSt_UM({
    ALL: false,
    WhatsApp: false,
    Messenger: false,
    Instagram: false,
    WebChat: false,
    'Mobile SDK': false
  });
  const toggleAgent = name => {
    setSelectedAgents(prev => prev.includes(name) ? prev.filter(a => a !== name) : [...prev, name]);
  };
  const toggleChannel = key => {
    if (key === 'ALL') {
      const next = !channels.ALL;
      setChannels({
        ALL: next,
        WhatsApp: next,
        Messenger: next,
        Instagram: next,
        WebChat: next,
        'Mobile SDK': next
      });
    } else {
      setChannels(prev => {
        const next = {
          ...prev,
          [key]: !prev[key]
        };
        const indiv = ['WhatsApp', 'Messenger', 'Instagram', 'WebChat', 'Mobile SDK'];
        next.ALL = indiv.every(k => next[k]);
        return next;
      });
    }
  };
  const filteredAgents = AVAILABLE_AGENTS.filter(a => a.toLowerCase().includes(agentQuery.toLowerCase()));
  const submit = () => {
    if (!teamName || !supervisor || selectedAgents.length === 0) return;
    const selectedChannels = Object.entries(channels).filter(([k, v]) => v && k !== 'ALL').map(([k]) => k);
    onCreate({
      teamName,
      supervisor,
      agents: selectedAgents,
      channels: selectedChannels
    });
    setTeamName('');
    setSupervisor('');
    setSelectedAgents([]);
    setAgentQuery('');
    setChannels({
      ALL: false,
      WhatsApp: false,
      Messenger: false,
      Instagram: false,
      WebChat: false,
      'Mobile SDK': false
    });
    onClose();
  };
  return /*#__PURE__*/React.createElement(Modal, {
    open: open,
    onClose: onClose,
    title: "Let's create a team",
    description: "Create a new team by filling out the information below.",
    width: 720,
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      onClick: onClose
    }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
      onClick: submit
    }, "Save Team"))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Team Name",
    required: true
  }, /*#__PURE__*/React.createElement(TextInput, {
    placeholder: "Enter team name",
    value: teamName,
    onChange: e => setTeamName(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Select Supervisor",
    required: true
  }, /*#__PURE__*/React.createElement(SelectInput, {
    value: supervisor,
    onChange: setSupervisor,
    placeholder: "Select Supervisor\u2026",
    options: [{
      value: 'John Smith',
      label: 'John Smith'
    }, {
      value: 'Sarah Johnson',
      label: 'Sarah Johnson'
    }, {
      value: 'Michael Brown',
      label: 'Michael Brown'
    }, {
      value: 'Emily Davis',
      label: 'Emily Davis'
    }]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12,
      background: '#F8F9FB',
      borderRadius: 10,
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      border: '1px solid #E4E7EC',
      borderRadius: 8,
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: '#191A21',
      marginBottom: 8
    }
  }, "Select Agents"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 12,
    style: {
      position: 'absolute',
      left: 8,
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#6B7180'
    }
  }), /*#__PURE__*/React.createElement(TextInput, {
    placeholder: "Search agents",
    value: agentQuery,
    onChange: e => setAgentQuery(e.target.value),
    style: {
      width: '100%',
      height: 30,
      paddingLeft: 28,
      fontSize: 12
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      maxHeight: 180,
      overflowY: 'auto'
    }
  }, filteredAgents.length > 0 ? filteredAgents.map(a => /*#__PURE__*/React.createElement("label", {
    key: a,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      cursor: 'pointer',
      padding: '4px 2px'
    }
  }, /*#__PURE__*/React.createElement(Checkbox, {
    checked: selectedAgents.includes(a),
    onChange: () => toggleAgent(a)
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: '#191A21'
    }
  }, a))) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: '#6B7180',
      padding: 4
    }
  }, "No agents found"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      border: '1px solid #E4E7EC',
      borderRadius: 8,
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: '#191A21',
      marginBottom: 8
    }
  }, "Assign Channels"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, ['ALL', ...CHANNELS].map(c => /*#__PURE__*/React.createElement("div", {
    key: c,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: c === 'ALL' ? 8 : 0,
      borderBottom: c === 'ALL' ? '1px solid #F3F4F6' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, c !== 'ALL' && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: CHANNEL_COLORS[c]
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: c === 'ALL' ? 700 : 500,
      color: '#191A21'
    }
  }, c)), /*#__PURE__*/React.createElement(Switch, {
    checked: channels[c],
    onChange: () => toggleChannel(c)
  }))))))));
}
Object.assign(window, {
  UsersPage,
  TeamsPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/digital_connect/UserTeamManagement.jsx", error: String((e && e.message) || e) }); }

// ui_kits/digital_connect/primitives.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* global React */
const {
  useState
} = React;
function cx(...xs) {
  return xs.filter(Boolean).join(' ');
}
window.cx = cx;
function Button({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  onClick,
  style,
  ...rest
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    borderRadius: 8,
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'background 150ms, color 150ms, border-color 150ms',
    whiteSpace: 'nowrap',
    userSelect: 'none'
  };
  const sizes = {
    sm: {
      height: 28,
      padding: '0 10px',
      fontSize: 12
    },
    md: {
      height: 36,
      padding: '0 14px',
      fontSize: 14
    },
    lg: {
      height: 42,
      padding: '0 18px',
      fontSize: 14
    },
    icon: {
      height: 36,
      width: 36,
      padding: 0,
      fontSize: 14
    }
  };
  const variants = {
    primary: {
      background: '#2781F6',
      color: '#fff',
      boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
    },
    secondary: {
      background: '#fff',
      color: '#191A21',
      borderColor: '#C9CCD5'
    },
    ghost: {
      background: 'transparent',
      color: '#3C3F4A'
    },
    destructive: {
      background: '#EF4444',
      color: '#fff'
    },
    soft: {
      background: '#F3F4F6',
      color: '#3C3F4A'
    },
    indigo: {
      background: '#363C82',
      color: '#fff'
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    onClick: onClick,
    style: {
      ...base,
      ...sizes[size],
      ...variants[variant],
      ...style
    },
    onMouseEnter: e => {
      if (variant === 'primary') e.currentTarget.style.background = '#1e6cd9';
      if (variant === 'secondary' || variant === 'ghost') e.currentTarget.style.background = '#F3F4F6';
      if (variant === 'soft') e.currentTarget.style.background = '#E4E7EC';
    },
    onMouseLeave: e => {
      e.currentTarget.style.background = variants[variant].background;
    }
  }, rest), icon, children);
}
function Badge({
  variant = 'neutral',
  children,
  style
}) {
  const styles = {
    neutral: {
      background: '#F3F4F6',
      color: '#3C3F4A'
    },
    blue: {
      background: '#E6F3FF',
      color: '#1D4ED8'
    },
    green: {
      background: '#DCFCE7',
      color: '#166534'
    },
    purple: {
      background: '#F3E8FF',
      color: '#6B21A8'
    },
    red: {
      background: '#FEE2E2',
      color: '#991B1B'
    },
    cyan: {
      background: '#CFFAFE',
      color: '#155E75'
    },
    yellow: {
      background: '#FEF3C7',
      color: '#92400E'
    }
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      height: 20,
      padding: '0 8px',
      borderRadius: 9999,
      fontFamily: 'var(--font-sans)',
      fontWeight: 700,
      fontSize: 10,
      letterSpacing: '0.04em',
      ...styles[variant],
      ...style
    }
  }, children);
}
function Input({
  icon,
  style,
  wrapperStyle,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      ...wrapperStyle
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 10,
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#6B7180',
      display: 'flex'
    }
  }, icon), /*#__PURE__*/React.createElement("input", _extends({}, rest, {
    style: {
      width: '100%',
      height: 36,
      padding: icon ? '0 12px 0 34px' : '0 12px',
      border: '1px solid #C9CCD5',
      borderRadius: 8,
      fontFamily: 'var(--font-sans)',
      fontSize: 14,
      color: '#191A21',
      outline: 'none',
      background: '#fff',
      ...style
    },
    onFocus: e => {
      e.currentTarget.style.borderColor = '#2781F6';
      e.currentTarget.style.boxShadow = '0 0 0 1px #2781F6';
      rest.onFocus && rest.onFocus(e);
    },
    onBlur: e => {
      e.currentTarget.style.borderColor = '#C9CCD5';
      e.currentTarget.style.boxShadow = 'none';
      rest.onBlur && rest.onBlur(e);
    }
  })));
}
function Avatar({
  name = '',
  src,
  size = 36,
  channel
}) {
  const initials = name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  // Deterministic color based on name
  const palette = [['#FEE2E2', '#991B1B'], ['#DCFCE7', '#166534'], ['#E6F3FF', '#1D4ED8'], ['#F3E8FF', '#6B21A8'], ['#FEF3C7', '#92400E'], ['#CFFAFE', '#155E75'], ['#FCE7F3', '#9D174D'], ['#E0E7FF', '#3730A3']];
  let h = 0;
  for (const c of name) h = h * 31 + c.charCodeAt(0) >>> 0;
  const [bg, fg] = palette[h % palette.length];
  const channelMap = {
    whatsapp: {
      bg: '#25D366',
      img: '../../assets/logos/whatsApp.png'
    },
    messenger: {
      bg: '#0084FF',
      img: '../../assets/logos/messenger.png'
    },
    instagram: {
      bg: 'linear-gradient(135deg,#F09433,#DC2743,#833AB4)',
      img: '../../assets/logos/instagram.png'
    }
  };
  const ch = channel && channelMap[channel];
  const badgeSize = Math.max(12, Math.round(size * 0.38));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: size,
      height: size,
      flexShrink: 0
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      objectFit: 'cover'
    }
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      background: bg,
      color: fg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-sans)',
      fontWeight: 700,
      fontSize: Math.round(size * 0.36)
    }
  }, initials), ch && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: badgeSize,
      height: badgeSize,
      borderRadius: '50%',
      background: ch.bg,
      border: '2px solid #fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: ch.img,
    style: {
      width: badgeSize * 0.6,
      height: badgeSize * 0.6,
      objectFit: 'contain'
    }
  })));
}

// Lucide-style icons (inline SVG, 2px stroke)
function Icon({
  name,
  size = 16,
  color = 'currentColor',
  style
}) {
  const paths = {
    search: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "11",
      cy: "11",
      r: "8"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "21",
      y1: "21",
      x2: "16.65",
      y2: "16.65"
    })),
    message: /*#__PURE__*/React.createElement("path", {
      d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
    }),
    phone: /*#__PURE__*/React.createElement("path", {
      d: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
    }),
    plus: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "5",
      x2: "12",
      y2: "19"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "5",
      y1: "12",
      x2: "19",
      y2: "12"
    })),
    send: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
      x1: "22",
      y1: "2",
      x2: "11",
      y2: "13"
    }), /*#__PURE__*/React.createElement("polygon", {
      points: "22 2 15 22 11 13 2 9 22 2"
    })),
    home: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "9 22 9 12 15 12 15 22"
    })),
    inbox: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("polyline", {
      points: "22 12 16 12 14 15 10 15 8 12 2 12"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
    })),
    bot: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "11",
      width: "18",
      height: "10",
      rx: "2",
      ry: "2"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "5",
      r: "2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 7v4"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "8",
      y1: "16",
      x2: "8",
      y2: "16"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "16",
      y1: "16",
      x2: "16",
      y2: "16"
    })),
    news: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M18 14h-8"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M15 18h-5"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10 6h8v4h-8V6z"
    })),
    megaphone: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M3 11l18-5v12L3 14v-3z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M11.6 16.8a3 3 0 1 1-5.8-1.6"
    })),
    users: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "9",
      cy: "7",
      r: "4"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M23 21v-2a4 4 0 0 0-3-3.87"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M16 3.13a4 4 0 0 1 0 7.75"
    })),
    settings: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
    })),
    paperclip: /*#__PURE__*/React.createElement("path", {
      d: "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
    }),
    smile: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "10"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M8 14s1.5 2 4 2 4-2 4-2"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "9",
      y1: "9",
      x2: "9.01",
      y2: "9"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "15",
      y1: "9",
      x2: "15.01",
      y2: "9"
    })),
    more: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "1"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "19",
      cy: "12",
      r: "1"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "5",
      cy: "12",
      r: "1"
    })),
    check: /*#__PURE__*/React.createElement("polyline", {
      points: "20 6 9 17 4 12"
    }),
    chevronLeft: /*#__PURE__*/React.createElement("polyline", {
      points: "15 18 9 12 15 6"
    }),
    chevronRight: /*#__PURE__*/React.createElement("polyline", {
      points: "9 18 15 12 9 6"
    }),
    chevronDown: /*#__PURE__*/React.createElement("polyline", {
      points: "6 9 12 15 18 9"
    }),
    filter: /*#__PURE__*/React.createElement("polygon", {
      points: "22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
    }),
    eye: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "3"
    })),
    logout: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "16 17 21 12 16 7"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "21",
      y1: "12",
      x2: "9",
      y2: "12"
    })),
    user: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "7",
      r: "4"
    })),
    share: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "18",
      cy: "5",
      r: "3"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "6",
      cy: "12",
      r: "3"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "18",
      cy: "19",
      r: "3"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "8.59",
      y1: "13.51",
      x2: "15.42",
      y2: "17.49"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "15.41",
      y1: "6.51",
      x2: "8.59",
      y2: "10.49"
    })),
    shield: /*#__PURE__*/React.createElement("path", {
      d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
    }),
    bellRing: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M13.73 21a2 2 0 0 1-3.46 0"
    })),
    mic: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "9",
      y: "2",
      width: "6",
      height: "12",
      rx: "3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M19 10v2a7 7 0 0 1-14 0v-2"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "19",
      x2: "12",
      y2: "22"
    })),
    videoOff: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "1",
      y1: "1",
      x2: "23",
      y2: "23"
    })),
    hash: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
      x1: "4",
      y1: "9",
      x2: "20",
      y2: "9"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "4",
      y1: "15",
      x2: "20",
      y2: "15"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "10",
      y1: "3",
      x2: "8",
      y2: "21"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "16",
      y1: "3",
      x2: "14",
      y2: "21"
    })),
    brand: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 3v18M3 12h18"
    }))
  };
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: style
  }, paths[name] || paths.brand);
}
Object.assign(window, {
  Button,
  Badge,
  Input,
  Avatar,
  Icon
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/digital_connect/primitives.jsx", error: String((e && e.message) || e) }); }

})();
