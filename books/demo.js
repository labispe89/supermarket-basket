// SYNTHETIC fixtures. Never loaded automatically or included in remote alerts.
export function demoData(now=Date.now()) {
  const base={title:'Δείγμα βιβλίου — όχι πραγματική ευκαιρία',author:'Συγγραφέας δείγματος',publisher:'Εκδότης δείγματος',isbn:'9780141036137',currency:'EUR',condition:'good',observedAt:new Date(now).toISOString(),source:'other',demand:12,competition:2,turnoverDays:30};
  return [{...base,id:'demo-buy',kind:'offer',price:3,url:'https://example.com/demo-buy'},...Array.from({length:3},(_,i)=>({...base,id:'demo-sold-'+i,kind:'sold',price:24+i,url:'https://example.com/demo-sold-'+i}))];
}
