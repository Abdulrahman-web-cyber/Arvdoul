// src/screens/CreatePost/sections/CommercialPartnershipsSection.jsx
import { useState } from 'react';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import { useCreatePostServices, useCreatePostState } from '../CreatePostContext.jsx';
import { COMMERCIAL_TYPES, INPUT_CLASS, SURFACE_GLASS_CLASS } from '../createPostConstants.js';
import collaborationService from '../../../services/collaborationService.js';

export default function CommercialPartnershipsSection() {
  const { state, dispatch } = useCreatePostState();
  const { searchUsers } = useCreatePostServices();
  const [partnerQuery, setPartnerQuery] = useState('');
  const [partnerResults, setPartnerResults] = useState([]);
  const [issuingAuth, setIssuingAuth] = useState(false);

  const commercial = state.commercialSettings || {};
  const disclosureType = commercial.disclosureType || 'none';

  const updateCommercial = (patch) => {
    dispatch({ type: 'SET_COMMERCIAL_SETTINGS', payload: patch });
  };

  const handlePartnerSearch = async (val) => {
    setPartnerQuery(val);
    if (val.trim().length < 2) {
      setPartnerResults([]);
      return;
    }
    try {
      const users = await searchUsers(val.trim());
      setPartnerResults(users || []);
    } catch (err) {
      console.warn('[CommercialPartnershipsSection] Partner search failed:', err?.message);
      setPartnerResults([]);
    }
  };

  const handleIssueAdAuthCode = async () => {
    if (!commercial.brandPartnerId) {
      toast.error('Select a brand partner first to issue a revocable ad authorization code.');
      return;
    }
    if (!state.editPostId) {
      updateCommercial({ allowPartnerPromotion: true });
      toast.info('Partner promotion enabled — the revocable ad authorization code will be issued automatically once this post publishes.');
      return;
    }
    setIssuingAuth(true);
    try {
      const res = await collaborationService.grantAdAuthorization({
        partnerId: commercial.brandPartnerId,
        partnerName: commercial.brandPartnerName || 'Brand Partner',
        postId: state.editPostId,
        expiresInDays: 30,
      });
      if (res?.authCode) {
        updateCommercial({
          adAuthorizationId: res.authorizationId || null,
          adAuthorizationCode: res.authCode,
          allowPartnerPromotion: true,
        });
        toast.success('Ad authorization code generated (expires in 30 days, revocable anytime).');
      }
    } catch (err) {
      toast.error(err?.message || 'Could not generate ad authorization code.');
    } finally {
      setIssuingAuth(false);
    }
  };

  return (
    <section
      id="composer-section-commercial"
      aria-labelledby="heading-commercial"
      className={`${SURFACE_GLASS_CLASS} p-4 sm:p-5 space-y-4`}
    >
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-xl bg-arvdoul-purple/12 text-arvdoul-purple flex items-center justify-center font-bold text-xs tabular-nums">
          05
        </span>
        <div>
          <h3 id="heading-commercial" className="text-sm font-semibold text-slate-900 dark:text-white">
            Commercial &amp; Brand Partnerships
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Transparent separation: organic vs own promotion vs paid partnership vs sponsored ad
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {COMMERCIAL_TYPES.map((type) => {
          const active = disclosureType === type.id;
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => updateCommercial({ disclosureType: type.id })}
              className={`p-3 rounded-xl border text-left transition-all ${
                active
                  ? 'border-arvdoul-purple bg-arvdoul-purple/10'
                  : 'border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  {type.label}
                </span>
                {type.badge && (
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-300">
                    {type.badge}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {type.description}
              </p>
            </button>
          );
        })}
      </div>

      {disclosureType === 'paid_partnership' && (
        <div className="p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-900 dark:text-white">
              Brand Partner Tag &amp; Ad Authorization
            </span>
            {commercial.brandPartnerName && (
              <button
                type="button"
                onClick={() =>
                  updateCommercial({
                    brandPartnerId: '',
                    brandPartnerName: '',
                    brandPartnerHandle: '',
                    adAuthorizationCode: '',
                    adAuthorizationId: null,
                  })
                }
                className="text-xs text-rose-500 hover:underline"
              >
                Clear partner
              </button>
            )}
          </div>

          {commercial.brandPartnerName ? (
            <div className="p-2.5 rounded-lg bg-white dark:bg-[#080F2E] border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2 text-xs">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {commercial.brandPartnerName}
                </p>
                {commercial.brandPartnerHandle && (
                  <p className="text-slate-500 dark:text-slate-400">
                    @{commercial.brandPartnerHandle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleIssueAdAuthCode}
                disabled={issuingAuth}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-arvdoul-purple text-white text-xs font-semibold disabled:opacity-50"
              >
                {issuingAuth ? 'Generating...' : 'Generate Ad Auth Code'}
              </button>
            </div>
          ) : (
            <div>
              <input
                aria-label="Search brand partner account"
                type="text"
                value={partnerQuery}
                onChange={(e) => handlePartnerSearch(e.target.value)}
                placeholder="Search brand account on Arvdoul..."
                className={INPUT_CLASS}
              />
              {partnerResults.length > 0 && (
                <div className="mt-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#080F2E] max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
                  {partnerResults.map((u) => (
                    <button
                      key={u.uid || u.id}
                      type="button"
                      onClick={() => {
                        updateCommercial({
                          brandPartnerId: u.uid || u.id,
                          brandPartnerName: u.displayName || u.name || u.username,
                          brandPartnerHandle: u.username || '',
                        });
                        setPartnerQuery('');
                        setPartnerResults([]);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-white/10 flex items-center justify-between"
                    >
                      <span className="font-semibold">{u.displayName || u.name || u.username}</span>
                      {u.username && <span className="text-slate-400">@{u.username}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {commercial.adAuthorizationCode && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <span className="text-emerald-700 dark:text-emerald-300 font-semibold block">
                  Active Ad Authorization Code
                </span>
                <span className="font-mono text-slate-900 dark:text-white">
                  {commercial.adAuthorizationCode}
                </span>
              </div>
              <Icons.ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            </div>
          )}
        </div>
      )}

      {disclosureType !== 'none' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label
              htmlFor="commercial-product-tag"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
            >
              Product or Service Tag
            </label>
            <input
              id="commercial-product-tag"
              type="text"
              value={commercial.productTag || ''}
              onChange={(e) => updateCommercial({ productTag: e.target.value })}
              placeholder="e.g. Studio Headphones Pro"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label
              htmlFor="commercial-promo-code"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
            >
              Promo / Discount Code
            </label>
            <input
              id="commercial-promo-code"
              type="text"
              value={commercial.promoCode || ''}
              onChange={(e) => updateCommercial({ promoCode: e.target.value.toUpperCase() })}
              placeholder="e.g. ARVDOUL20"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label
              htmlFor="commercial-affiliate-url"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
            >
              Affiliate / Destination URL
            </label>
            <input
              id="commercial-affiliate-url"
              type="url"
              value={commercial.affiliateUrl || ''}
              onChange={(e) => updateCommercial({ affiliateUrl: e.target.value, ctaUrl: e.target.value })}
              placeholder="https://example.com/offer"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label
              htmlFor="commercial-cta-label"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
            >
              Call-to-Action Label
            </label>
            <input
              id="commercial-cta-label"
              type="text"
              value={commercial.ctaLabel || 'Learn More'}
              onChange={(e) => updateCommercial({ ctaLabel: e.target.value })}
              placeholder="Learn More / Shop Now"
              className={INPUT_CLASS}
            />
          </div>
        </div>
      )}
    </section>
  );
}
