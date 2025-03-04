import graphqlFields from 'graphql-fields';
import db from '../../helpers/mysql';
import { formatProposal, formatVote } from '../helpers';
import log from '../../helpers/log';
import { capture } from '@snapshot-labs/snapshot-sentry';

export default async function (parent, { id }, context, info) {
  const requestedFields = info ? graphqlFields(info) : {};
  const query = `
    SELECT v.*,
      spaces.settings,
      spaces.flagged as spaceFlagged,
      spaces.verified as spaceVerified,
      spaces.turbo as spaceTurbo,
      spaces.hibernated as spaceHibernated
    FROM votes v
    INNER JOIN spaces ON spaces.id = v.space
    WHERE v.id = ? AND spaces.settings IS NOT NULL
    LIMIT 1
  `;
  try {
    const votes = await db.queryAsync(query, [id]);
    const result = votes.map(vote => formatVote(vote))[0] || null;
    if (requestedFields.proposal && result?.proposal) {
      const proposalId = result.proposal;
      const query = `
        SELECT p.*,
          spaces.settings,
          spaces.flagged as spaceFlagged,
          spaces.verified as spaceVerified,
          spaces.turbo as spaceTurbo,
          spaces.hibernated as spaceHibernated
        FROM proposals p
        INNER JOIN spaces ON spaces.id = p.space
        WHERE spaces.settings IS NOT NULL AND p.id = ?
      `;
      try {
        const proposals = await db.queryAsync(query, [proposalId]);
        result.proposal = formatProposal(proposals[0]);
      } catch (e: any) {
        log.error(`[graphql] vote, ${JSON.stringify(e)}`);
        capture(e, { id, context, info });
        return Promise.reject(new Error('request failed'));
      }
    }
    return result;
  } catch (e: any) {
    log.error(`[graphql] vote, ${JSON.stringify(e)}`);
    capture(e, { id, context, info });
    return Promise.reject(new Error('request failed'));
  }
}
