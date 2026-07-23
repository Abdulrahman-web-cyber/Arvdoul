import{c as e,n as t,t as n}from"./jsx-runtime-eu958idE.js";import{a as r}from"./index-6hIPxxyX.js";import{t as i}from"./motion-B3q5-htu.js";import{n as a}from"./EmptyState-q3NnKiiZ.js";var o=e(t(),1),s=n(),c=(0,o.memo)(({title:e=`Something went wrong`,message:t=`We encountered an error while loading this content.`,code:n,onRetry:c,onDismiss:u,severity:d=`error`,className:f=``})=>{let{isDark:p,colors:m,gradient:h,spring:g,spacing:_}=r(),v=(0,o.useMemo)(()=>{let e={error:{icon:(0,s.jsx)(`svg`,{className:`w-full h-full`,fill:`none`,viewBox:`0 0 24 24`,stroke:`currentColor`,children:(0,s.jsx)(`path`,{strokeLinecap:`round`,strokeLinejoin:`round`,strokeWidth:1.5,d:`M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z`})}),gradient:`from-red-500 via-pink-500 to-red-400`,border:p?`border-red-500/30`:`border-red-200`,bg:p?`bg-red-500/10`:`bg-red-50`,text:p?`text-red-400`:`text-red-600`},warning:{icon:(0,s.jsx)(`svg`,{className:`w-full h-full`,fill:`none`,viewBox:`0 0 24 24`,stroke:`currentColor`,children:(0,s.jsx)(`path`,{strokeLinecap:`round`,strokeLinejoin:`round`,strokeWidth:1.5,d:`M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z`})}),gradient:`from-amber-500 via-orange-500 to-amber-400`,border:p?`border-amber-500/30`:`border-amber-200`,bg:p?`bg-amber-500/10`:`bg-amber-50`,text:p?`text-amber-400`:`text-amber-600`},info:{icon:(0,s.jsx)(`svg`,{className:`w-full h-full`,fill:`none`,viewBox:`0 0 24 24`,stroke:`currentColor`,children:(0,s.jsx)(`path`,{strokeLinecap:`round`,strokeLinejoin:`round`,strokeWidth:1.5,d:`M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z`})}),gradient:`from-blue-500 via-indigo-500 to-blue-400`,border:p?`border-blue-500/30`:`border-blue-200`,bg:p?`bg-blue-500/10`:`bg-blue-50`,text:p?`text-blue-400`:`text-blue-600`}};return e[d]||e.error},[d,p]),y=(0,o.useMemo)(()=>({initial:{opacity:0,scale:.95,y:20},animate:{opacity:1,scale:1,y:0},exit:{opacity:0,scale:.95,y:-20},transition:g.card}),[g.card]),b=(0,o.useMemo)(()=>({initial:{scale:0,rotate:-90},animate:{scale:1,rotate:0,transition:{type:`spring`,damping:12,stiffness:180,delay:.05}}}),[]);return(0,s.jsxs)(i.div,{...y,className:`
        flex
        flex-col
        items-center
        justify-center
        p-8
        text-center
        ${v.bg}
        backdrop-blur-xl
        border
        ${v.border}
        rounded-3xl
        ${f}
      `,role:`alert`,"aria-live":`assertive`,children:[(0,s.jsx)(i.div,{...b,className:`
          w-20
          h-20
          mb-6
          rounded-full
          flex
          items-center
          justify-center
          ${p?`bg-white/10`:`bg-white`}
          shadow-lg
        `,children:(0,s.jsx)(`div`,{className:`w-14 h-14`,style:{color:d===`error`?`#EF4444`:d===`warning`?`#F59E0B`:`#3B82F6`},children:v.icon})}),n&&(0,s.jsx)(i.span,{initial:{opacity:0,y:-10},animate:{opacity:1,y:0},transition:{delay:.1},className:`
            text-xs
            font-mono
            px-2
            py-1
            rounded-full
            mb-3
            ${p?`bg-white/10 text-gray-400`:`bg-gray-100 text-gray-500`}
          `,children:n}),(0,s.jsx)(`h3`,{className:`
          text-xl
          font-bold
          mb-2
          ${p?`text-white`:`text-gray-900`}
        `,children:e}),t&&(0,s.jsx)(`p`,{className:`
            text-sm
            max-w-md
            mb-6
            ${p?`text-gray-400`:`text-gray-600`}
          `,children:t}),(0,s.jsxs)(`div`,{className:`flex items-center gap-3`,children:[c&&(0,s.jsx)(a,{variant:`gradient`,size:`md`,onClick:c,icon:l,children:`Try Again`}),u&&(0,s.jsx)(a,{variant:`ghost`,size:`md`,onClick:u,children:`Dismiss`})]})]})});c.displayName=`ErrorState`;var l=({className:e})=>(0,s.jsx)(`svg`,{className:e,fill:`none`,viewBox:`0 0 24 24`,stroke:`currentColor`,children:(0,s.jsx)(`path`,{strokeLinecap:`round`,strokeLinejoin:`round`,strokeWidth:2,d:`M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15`})});c.Network=(0,o.memo)(({onRetry:e})=>(0,s.jsx)(c,{title:`Connection lost`,message:`Please check your internet connection and try again.`,code:`ERR_NETWORK`,severity:`warning`,onRetry:e})),c.Network.displayName=`ErrorState.Network`,c.Server=(0,o.memo)(({onRetry:e})=>(0,s.jsx)(c,{title:`Server error`,message:`Our servers are having trouble. Please try again in a few moments.`,code:`ERR_SERVER`,severity:`error`,onRetry:e})),c.Server.displayName=`ErrorState.Server`,c.Auth=(0,o.memo)(({onLogin:e})=>(0,s.jsx)(c,{title:`Session expired`,message:`Please sign in again to continue.`,code:`ERR_AUTH`,severity:`warning`,onRetry:e})),c.Auth.displayName=`ErrorState.Auth`,c.NotFound=(0,o.memo)(({onGoBack:e})=>(0,s.jsx)(c,{title:`Content not found`,message:`The content you're looking for doesn't exist or has been removed.`,code:`ERR_NOT_FOUND`,severity:`info`,onRetry:e})),c.NotFound.displayName=`ErrorState.NotFound`;export{c as t};