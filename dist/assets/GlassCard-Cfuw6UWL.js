import{c as e,n as t,t as n}from"./jsx-runtime-eu958idE.js";import{a as r}from"./index-CzAFXf0j.js";import{t as i}from"./motion-B3q5-htu.js";var a=e(t(),1),o=n(),s=(0,a.memo)(({children:e,size:t=`md`,glow:n=!1,hoverable:s=!0,className:c=``,onClick:l,disabled:u=!1,...d})=>{let{isDark:f,glass:p,spring:m,colors:h}=r(),g=(0,a.useMemo)(()=>({sm:p.small,md:p.medium,lg:p.large,xl:p.ultra})[t]||p.medium,[t,p]),_=(0,a.useMemo)(()=>n?f?`shadow-[0_25px_80px_rgba(138,43,226,0.45)] hover:shadow-[0_35px_100px_rgba(138,43,226,0.55)]`:`shadow-[0_25px_80px_rgba(0,0,0,0.08)] hover:shadow-[0_35px_100px_rgba(0,0,0,0.12)]`:h.shadow.card,[n,f,h.shadow.card]),v=(0,a.useMemo)(()=>({initial:{opacity:0,y:20},animate:{opacity:1,y:0},exit:{opacity:0,y:-10},transition:m.card}),[m.card]);return(0,o.jsx)(i.div,{...v,whileHover:s&&!u?{scale:1.02,y:-4}:{},whileTap:s&&!u?{scale:.98}:{},className:`
        ${g}
        ${_}
        rounded-3xl
        ${s?`cursor-pointer`:``}
        ${u?`opacity-50 cursor-not-allowed`:``}
        ${c}
      `,onClick:u?void 0:l,role:l?`button`:void 0,tabIndex:l&&!u?0:void 0,"aria-disabled":u,...d,children:e})});s.displayName=`GlassCard`;